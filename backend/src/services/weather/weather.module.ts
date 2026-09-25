import { Module } from '@nestjs/common';
import { WeatherProvider } from './weather.provider';

@Module({
  providers: [WeatherProvider],
  exports: [WeatherProvider],
})
export class WeatherModule {}
