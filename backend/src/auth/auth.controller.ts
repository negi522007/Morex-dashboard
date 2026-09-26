import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { AuthService, PublicUser } from './auth.service';
import { parseBirthDate } from '../common/birth-date.util';
import { asPageLang, langFromHeader, renderConfirmPage } from './confirm-page';
import { EpitechOidcService } from './epitech-oidc.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { setSessionCookie } from '../common/session-cookie.util';
import { AVATARS_DIR } from '../common/uploads.util';

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly epitechOidc: EpitechOidcService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account. Sends a confirmation email; login is blocked until confirmed.' })
  @ApiBody({
    schema: {
      example: {
        email: 'user@example.com',
        password: 'at least 8 characters',
        firstName: 'Ada',
        lastName: 'Lovelace',
        birthDate: '2001-02-28',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Account created, confirmation email sent' })
  @ApiResponse({ status: 400, description: 'Invalid email, password under 8 characters, or missing firstName/lastName' })
  @ApiResponse({ status: 409, description: 'An account with this email already exists' })
  @ApiResponse({ status: 503, description: 'Confirmation email failed to send — account was NOT created' })
  async register(
    @Body() body: { email?: string; password?: string; firstName?: string; lastName?: string; birthDate?: string },
    @Req() req: Request,
  ) {
    const { email, password } = this.validateCredentials(body);
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    if (!firstName) {
      throw new BadRequestException('First name is required');
    }
    if (!lastName) {
      throw new BadRequestException('Last name is required');
    }
    // Optional for now so existing clients keep working; set REQUIRE_BIRTH_DATE=true once the form asks for it.
    const hasBirthDate = body.birthDate !== undefined && body.birthDate !== null && body.birthDate !== '';
    if (!hasBirthDate && this.config.get<string>('REQUIRE_BIRTH_DATE') === 'true') {
      throw new BadRequestException('Date of birth is required');
    }
    const birthDate = hasBirthDate ? parseBirthDate(body.birthDate) : null;
    return this.authService.register(email, password, firstName, lastName, birthDate, langFromHeader(req.headers['accept-language']));
  }

  // The link in the confirmation email. It shows a page that ASKS ("is this you?") and changes nothing:
  // mail scanners and link previews open links automatically, so a GET must never confirm an account.
  @Get('confirm')
  @ApiOperation({ summary: 'Page behind the emailed link: "Is this you?" with a confirm and a "not me" button (HTML). Set CONFIRM_PAGE_URL to send users to your own frontend page instead.' })
  @ApiResponse({ status: 200, description: 'HTML page (also for an invalid/expired token, which shows a "link doesn\'t work" page)' })
  @ApiResponse({ status: 302, description: 'CONFIRM_PAGE_URL is set: redirect to it with ?token=' })
  async confirmPage(@Query('token') token: string, @Query('lang') lang: string, @Req() req: Request, @Res() res: Response) {
    const custom = this.config.get<string>('CONFIRM_PAGE_URL');
    if (custom) return res.redirect(`${custom}${custom.includes('?') ? '&' : '?'}token=${encodeURIComponent(token ?? '')}`);
    const pending = await this.authService.previewConfirmation(String(token ?? '')).catch(() => null);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).type('html').send(
      renderConfirmPage({
        lang: lang ? asPageLang(lang) : langFromHeader(req.headers['accept-language']),
        token: String(token ?? ''),
        pending,
        frontendUrl,
      }),
    );
  }

  @Get('confirm/preview')
  @ApiOperation({ summary: 'JSON: who a confirmation link is for (masked email, first name) — for a custom confirmation page. Changes nothing.' })
  @ApiResponse({ status: 200, description: '{ email: "a***@gmail.com", firstName, expiresAt }' })
  @ApiResponse({ status: 401, description: 'Invalid, used or expired link' })
  preview(@Query('token') token: string) {
    return this.authService.previewConfirmation(String(token ?? ''));
  }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: '"Yes, it is me": confirm the account behind the token' })
  @ApiBody({ schema: { example: { token: '64 hex characters from the email link' } } })
  @ApiResponse({ status: 200, description: '{ status: "confirmed" } — the user can now log in' })
  @ApiResponse({ status: 401, description: 'Invalid, used or expired link' })
  async confirm(@Body() body: { token?: string }) {
    if (!body?.token) throw new BadRequestException('Missing confirmation token');
    await this.authService.confirmEmail(body.token);
    return { status: 'confirmed' };
  }

  @Post('confirm/reject')
  @HttpCode(200)
  @ApiOperation({ summary: '"No, it was not me": delete the pending account and stop mailing that address for 24 h' })
  @ApiBody({ schema: { example: { token: '64 hex characters from the email link' } } })
  @ApiResponse({ status: 200, description: '{ status: "removed" }' })
  @ApiResponse({ status: 401, description: 'Invalid, used or expired link' })
  async reject(@Body() body: { token?: string }) {
    if (!body?.token) throw new BadRequestException('Missing confirmation token');
    await this.authService.rejectConfirmation(body.token);
    return { status: 'removed' };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in. Sets the session cookie on success.' })
  @ApiBody({ schema: { example: { email: 'user@example.com', password: 'a-real-password' } } })
  @ApiResponse({ status: 200, description: 'Logged in; Set-Cookie: dashboard_session=... attached' })
  @ApiResponse({ status: 401, description: 'Unknown email or wrong password' })
  @ApiResponse({ status: 403, description: 'Correct credentials, but the email is not confirmed yet' })
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = this.validateCredentials(body);
    const { session, user } = await this.authService.login(email, password);
    setSessionCookie(res, this.config, session.id, session.expiresAt);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Log out. Deletes the session server-side, so it stops working immediately.' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
    const sessionId = req.cookies?.[cookieName];
    await this.authService.logout(sessionId);
    res.clearCookie(cookieName);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Get the currently logged-in user — useful to check auth state on app load' })
  @ApiResponse({ status: 200, description: 'The current user, plus githubLinked and `epitech` (linked My Epitech profile or null)' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  async me(@CurrentUser() user: PublicUser) {
    const githubLinked = await this.authService.hasLinkedGithub(user.id);
    const epitech = await this.epitechOidc.profileOf(user.id);
    return { ...user, githubLinked, epitech };
  }

  @Patch('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({
    summary:
      'Update your own profile: name, password, bio, theme, language, widget skin, and/or DiceBear avatar config. Email change is not supported here.',
  })
  @ApiBody({
    schema: {
      example: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        currentPassword: 'the-old-password',
        newPassword: 'at-least-8-characters',
        bio: 'Building things.',
        theme: 'desertMoon',
        language: 'en',
        widgetSkin: 'glass',
        avatarConfig: { skinColor: 'ae5d29', top: 'curly' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated user. A password change kills every OTHER session.' })
  @ApiResponse({
    status: 400,
    description: 'Empty body, a blank name, bio over 280 chars, an invalid theme/language/widgetSkin, or new password under 8 characters',
  })
  @ApiResponse({ status: 401, description: 'currentPassword is wrong (only checked when changing password)' })
  updateMe(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      currentPassword?: string;
      newPassword?: string;
      bio?: string;
      theme?: string;
      language?: string;
      widgetSkin?: string;
      avatarConfig?: unknown;
      birthDate?: string | null;
    },
  ) {
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
    const sessionId = req.cookies?.[cookieName];
    return this.authService.updateProfile(user.id, sessionId, body);
  }

  @Post('me/avatar')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a real photo as your avatar (replaces any DiceBear-generated one in the UI)' })
  @ApiBody({ schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 200, description: 'Updated user, avatarPhotoUrl now set' })
  @ApiResponse({ status: 400, description: 'Missing file, wrong type (jpeg/png/webp/gif only), or over 5MB' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: AVATARS_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: MAX_PHOTO_BYTES },
      fileFilter: (_req, file, cb) => cb(null, ALLOWED_PHOTO_TYPES.has(file.mimetype)),
    }),
  )
  uploadAvatarPhoto(@CurrentUser() user: { id: string }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No photo uploaded, or it was not a jpeg/png/webp/gif under 5MB');
    }
    return this.authService.setAvatarPhoto(user.id, `/uploads/avatars/${file.filename}`);
  }

  @Delete('me/avatar')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Remove your uploaded photo (falls back to the DiceBear-generated avatar)' })
  @ApiResponse({ status: 200, description: 'Updated user, avatarPhotoUrl now null' })
  removeAvatarPhoto(@CurrentUser() user: { id: string }) {
    return this.authService.removeAvatarPhoto(user.id);
  }

  private validateCredentials(body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !EMAIL_RE.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    return { email, password };
  }
}
