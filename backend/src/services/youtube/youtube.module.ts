import { Module } from '@nestjs/common';
import { YoutubeProvider } from './youtube.provider';

@Module({
  providers: [YoutubeProvider],
  exports: [YoutubeProvider],
})
export class YoutubeModule {}
