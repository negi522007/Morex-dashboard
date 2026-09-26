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
import { AlertsModule } from './alerts/alerts.module';
import { ShareModule } from './share/share.module';
import { BriefModule } from './brief/brief.module';
import { AssistantModule } from './assistant/assistant.module';
import { WellbeingModule } from './wellbeing/wellbeing.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
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
    AlertsModule,
    ShareModule,
    BriefModule,
    AssistantModule,
    HelpdeskModule,
    WellbeingModule,
  ],
})
export class AppModule {}
