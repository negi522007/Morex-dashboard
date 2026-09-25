import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AboutModule } from './about/about.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { TimerModule } from './timer/timer.module';
import { WidgetsModule } from './widgets/widgets.module';
import { AdminModule } from './admin/admin.module';
import { JournalModule } from './journal/journal.module';
import { AiModule } from './ai/ai.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServicesModule,
    PrismaModule,
    AboutModule,
    AuthModule,
    TimerModule,
    WidgetsModule,
    AdminModule,
    JournalModule,
    AiModule,
    InsightsModule,
  ],
})
export class AppModule {}
