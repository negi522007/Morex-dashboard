import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GithubOAuthController } from './github-oauth.controller';
import { GoogleOAuthController } from './google-oauth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { MailModule } from '../mail/mail.module';
import { EpitechOidcService } from './epitech-oidc.service';
import { MicrosoftOidcService } from './microsoft-oidc.service';
import { OidcAccountsService } from './oidc-accounts.service';
import { makeOidcController } from './oidc-controller.factory';
import { UnconfirmedCleanupService } from './unconfirmed-cleanup.service';

// Same six routes for each OpenID Connect provider: /auth/epitech/* and /auth/microsoft/*.
const EpitechOAuthController = makeOidcController({ route: 'auth/epitech', label: 'My Epitech', cookie: 'epitech_oidc', flow: EpitechOidcService });
const MicrosoftOAuthController = makeOidcController({ route: 'auth/microsoft', label: 'Microsoft', cookie: 'microsoft_oidc', flow: MicrosoftOidcService });

@Module({
  imports: [MailModule],
  controllers: [AuthController, GithubOAuthController, GoogleOAuthController, EpitechOAuthController, MicrosoftOAuthController],
  providers: [AuthService, SessionGuard, OidcAccountsService, EpitechOidcService, MicrosoftOidcService, UnconfirmedCleanupService],
  exports: [SessionGuard, AuthService],
})
export class AuthModule {}
