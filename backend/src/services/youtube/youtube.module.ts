import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { YoutubeProvider } from './youtube.provider';
import { YoutubeCountriesController } from './youtube-countries.controller';
import { YoutubeChannelsController } from './youtube-channels.controller';

@Module({
  imports: [AuthModule],
  controllers: [YoutubeCountriesController, YoutubeChannelsController],
  providers: [YoutubeProvider],
  exports: [YoutubeProvider],
})
export class YoutubeModule {}
