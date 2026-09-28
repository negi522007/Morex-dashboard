import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RssProvider } from './rss.provider';
import { RssFeedsController } from './rss-feeds.controller';

@Module({
  imports: [AuthModule],
  controllers: [RssFeedsController],
  providers: [RssProvider],
  exports: [RssProvider],
})
export class RssModule {}
