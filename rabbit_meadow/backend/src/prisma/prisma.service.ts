import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const maxAttempts = 3;

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

        await new Promise((resolve) => setTimeout(resolve, 1000));
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
