import { Module } from '@nestjs/common';
import { CustomApiProvider } from './custom-api.provider';

@Module({
  providers: [CustomApiProvider],
  exports: [CustomApiProvider],
})
export class CustomApiModule {}
