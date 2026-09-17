import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AboutModule } from './about/about.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AboutModule, AuthModule],
})
export class AppModule {}
