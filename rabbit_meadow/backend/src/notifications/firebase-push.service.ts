import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'node:fs';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

type PushResult = {
  attemptedTokens: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
};

const FIREBASE_APP_NAME = 'al-arnab-notifications';
const MAX_MULTICAST_TOKENS = 500;
const WEB_PUSH_ICON = '/favicon.svg';

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FirebasePushService {
  private readonly logger = new Logger(FirebasePushService.name);
  private app: App | null = null;
  private initChecked = false;
  private warnedMissingConfig = false;

  constructor(private readonly configService: ConfigService) {}

  async sendToTokens(tokens: string[], payload: PushPayload): Promise<PushResult> {
    const normalizedTokens = Array.from(
      new Set(
        tokens
          .map((token) => String(token || '').trim())
          .filter(Boolean),
      ),
    );

    if (!normalizedTokens.length) {
      return {
        attemptedTokens: 0,
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      };
    }

    const app = this.getApp();
    if (!app) {
      return {
        attemptedTokens: normalizedTokens.length,
        successCount: 0,
        failureCount: normalizedTokens.length,
        invalidTokens: [],
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];
    const messaging = getMessaging(app);

    for (let start = 0; start < normalizedTokens.length; start += MAX_MULTICAST_TOKENS) {
      const batchTokens = normalizedTokens.slice(start, start + MAX_MULTICAST_TOKENS);
      const message: MulticastMessage = {
        tokens: batchTokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: WEB_PUSH_ICON,
          },
          fcmOptions: payload.data?.link
            ? {
                link: payload.data.link,
              }
            : undefined,
        },
      };

      try {
        const response = await messaging.sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((result, index) => {
          if (result.success) return;

          const code = result.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(batchTokens[index]);
          }
        });
      } catch (error) {
        failureCount += batchTokens.length;
        this.logger.warn(
          `Failed to send Firebase push notifications batch (${start + 1}-${start + batchTokens.length}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      attemptedTokens: normalizedTokens.length,
      successCount,
      failureCount,
      invalidTokens,
    };
  }

  private getApp(): App | null {
    if (this.app) return this.app;
    if (this.initChecked) return null;
    this.initChecked = true;

    const serviceAccount = this.loadServiceAccount();
    const projectId =
      serviceAccount?.project_id ||
      this.configService.get<string>('FIREBASE_PROJECT_ID', '').trim();
    const clientEmail =
      serviceAccount?.client_email ||
      this.configService.get<string>('FIREBASE_CLIENT_EMAIL', '').trim();
    const rawPrivateKey =
      serviceAccount?.private_key ||
      this.configService.get<string>('FIREBASE_PRIVATE_KEY', '').trim();
    const storageBucket = this.configService.get<string>('FIREBASE_STORAGE_BUCKET', '').trim();

    if (!projectId || !clientEmail || !rawPrivateKey) {
      if (!this.warnedMissingConfig) {
        this.warnedMissingConfig = true;
        this.logger.warn(
          'Firebase push config is incomplete. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable push.',
        );
      }
      return null;
    }

    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    const existing = getApps().find((item) => item.name === FIREBASE_APP_NAME);
    if (existing) {
      this.app = existing;
      return this.app;
    }

    this.app = initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        ...(storageBucket ? { storageBucket } : {}),
      },
      FIREBASE_APP_NAME,
    );

    return this.app;
  }

  private loadServiceAccount(): FirebaseServiceAccount | null {
    const serviceAccountPath = this.configService
      .get<string>('FIREBASE_SERVICE_ACCOUNT_PATH', '')
      .trim();

    if (!serviceAccountPath) {
      return null;
    }

    if (!existsSync(serviceAccountPath)) {
      this.logger.warn(`Firebase service account file was not found: ${serviceAccountPath}`);
      return null;
    }

    try {
      const raw = readFileSync(serviceAccountPath, 'utf8').trim();
      if (!raw) {
        this.logger.warn(`Firebase service account file is empty: ${serviceAccountPath}`);
        return null;
      }

      return JSON.parse(raw) as FirebaseServiceAccount;
    } catch (error) {
      this.logger.warn(
        `Failed to read Firebase service account file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
