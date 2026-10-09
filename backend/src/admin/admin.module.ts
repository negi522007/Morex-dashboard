import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { AdminController, AdminServicesController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [AuthModule, MailModule],
  controllers: [AdminController, AdminServicesController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
