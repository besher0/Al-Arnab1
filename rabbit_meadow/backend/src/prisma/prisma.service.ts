import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_CONNECT_TIMEOUT_SECONDS = 15;
const DEFAULT_POOL_TIMEOUT_SECONDS = 30;
const DEFAULT_STARTUP_CONNECT_ATTEMPTS = 8;
const RETRY_BASE_DELAY_MS = 1_500;
const RETRY_MAX_DELAY_MS = 12_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withDefaultPrismaTimeouts(databaseUrl?: string): string | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(databaseUrl);

    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', String(DEFAULT_CONNECT_TIMEOUT_SECONDS));
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(DEFAULT_POOL_TIMEOUT_SECONDS));
    }

    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = withDefaultPrismaTimeouts(process.env.DATABASE_URL);
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  }

  async onModuleInit() {
    const maxAttempts = parsePositiveInt(
      process.env.PRISMA_CONNECT_RETRIES,
      DEFAULT_STARTUP_CONNECT_ATTEMPTS,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Prisma connected after retry ${attempt}/${maxAttempts}.`);
        }
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          this.logger.error(
            'Prisma failed to connect during app startup. The API will start, but DB-backed endpoints may return errors until DB is reachable.',
            error instanceof Error ? error.message : String(error),
          );
          return;
        }

        const retryDelayMs = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
        this.logger.warn(
          `Prisma connect attempt ${attempt}/${maxAttempts} failed. Retrying in ${retryDelayMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // Ignore disconnect failures during shutdown.
    }
  }
}
