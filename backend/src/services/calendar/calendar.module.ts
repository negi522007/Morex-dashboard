import { Module } from '@nestjs/common';
import { CalendarProvider } from './calendar.provider';

@Module({
  providers: [CalendarProvider],
  exports: [CalendarProvider],
})
export class CalendarModule {}
