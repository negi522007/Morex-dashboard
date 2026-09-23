import { BadRequestException, Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionGuard } from '../../auth/session.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { decryptToken } from '../../common/token-encryption.util';
import { ServiceFetchError } from '../service-provider.interface';
import { GithubProvider } from './github.provider';

// Feeds the "repo" dropdown on the add/reconfigure widget form (see
// WidgetParam.optionsUrl in service-provider.interface.ts) — not a widget
// data source itself, so it lives outside the ServiceProvider contract.
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/github')
@UseGuards(SessionGuard)
export class GithubReposController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly githubProvider: GithubProvider,
  ) {}

  @Get('repos')
  @ApiOperation({
    summary: "List the current user's GitHub repositories — options for the widget form's repo picker",
  })
  @ApiResponse({ status: 200, description: 'Array of { value, label }, each value an "owner/repo" string' })
  @ApiResponse({ status: 400, description: 'No GitHub account linked for this user, or GitHub rejected the request' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  @ApiResponse({ status: 503, description: 'Server missing TOKEN_ENCRYPTION_KEY' })
  async listRepos(@CurrentUser() user: { id: string }) {
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new ServiceUnavailableException('Server is missing TOKEN_ENCRYPTION_KEY');
    }

    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: { userId: user.id, provider: 'github' },
    });
    if (!oauthAccount) {
      throw new BadRequestException('No linked GitHub account for this user — connect one via GET /auth/github first');
    }

    const accessToken = decryptToken(oauthAccount.accessTokenEncrypted, encryptionKey);

    try {
      return await this.githubProvider.listRepos({ accessToken });
    } catch (err) {
      // ServiceFetchError is meant for the scheduler's catch loop; at this
      // HTTP boundary it needs to become a real Nest exception so the
      // client gets a proper status code and message instead of a generic
      // 500 from Nest's default (message-hiding) exception filter.
      if (err instanceof ServiceFetchError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
