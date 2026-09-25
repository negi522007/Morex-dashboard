import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GithubOAuthController } from './github-oauth.controller';
import { EpitechOAuthController } from './epitech-oauth.controller';
import { EpitechOidcService } from './epitech-oidc.service';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [AuthController, GithubOAuthController, EpitechOAuthController],
  providers: [AuthService, SessionGuard, EpitechOidcService],
  exports: [SessionGuard, AuthService],
})
export class AuthModule {}
