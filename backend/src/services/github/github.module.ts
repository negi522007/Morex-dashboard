import { Module } from '@nestjs/common';
import { GithubProvider } from './github.provider';
import { GithubReposController } from './github-repos.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GithubReposController],
  providers: [GithubProvider],
  exports: [GithubProvider],
})
export class GithubModule {}
