import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CustomApiProvider } from './custom-api.provider';
import { CustomApiInspectController } from './custom-api-inspect.controller';

@Module({
  imports: [AuthModule],
  controllers: [CustomApiInspectController],
  providers: [CustomApiProvider],
  exports: [CustomApiProvider],
})
export class CustomApiModule {}
