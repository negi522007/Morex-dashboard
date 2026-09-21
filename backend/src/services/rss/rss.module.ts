import { Module } from '@nestjs/common';
import { RssProvider } from './rss.provider';

@Module({
  providers: [RssProvider],
  exports: [RssProvider],
})
export class RssModule {}
