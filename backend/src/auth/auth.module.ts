import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GithubOAuthController } from './github-oauth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AuthController, GithubOAuthController],
  providers: [AuthService, SessionGuard],
  exports: [SessionGuard, AuthService],
})
export class AuthModule {}
