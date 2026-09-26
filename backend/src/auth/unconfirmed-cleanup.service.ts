import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_TOKEN_TTL_MS } from './auth.service';

const EVERY_MS = 60 * 60 * 1000;

// A signup that was never confirmed is removed once its confirmation link has
// expired, freeing the address for its real owner. OAuth accounts are created
// already verified, so they are never touched.
@Injectable()
export class UnconfirmedCleanupService {
  private readonly logger = new Logger(UnconfirmedCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Interval(EVERY_MS)
  async purge(): Promise<number> {
    const { count } = await this.prisma.user.deleteMany({
      where: { emailVerified: false, createdAt: { lt: new Date(Date.now() - EMAIL_TOKEN_TTL_MS) } },
    });
    if (count > 0) this.logger.log(`Removed ${count} unconfirmed account(s) older than 24h`);
    return count;
  }
}
