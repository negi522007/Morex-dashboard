import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { WeatherProvider } from './weather.provider';
import { WeatherCitiesController } from './weather-cities.controller';

@Module({
  imports: [AuthModule],
  controllers: [WeatherCitiesController],
  providers: [WeatherProvider],
  exports: [WeatherProvider],
})
export class WeatherModule {}
