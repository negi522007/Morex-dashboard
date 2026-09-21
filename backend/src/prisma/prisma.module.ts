import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global so any feature module (auth, widgets, ...) can inject PrismaService
// without re-importing this module every time.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
