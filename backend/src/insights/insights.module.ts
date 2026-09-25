import { Global, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RefreshHooksService } from './refresh-hooks.service';

@Global()
@Module({
  imports: [MailModule],
  providers: [RefreshHooksService],
  exports: [RefreshHooksService],
})
export class InsightsModule {}
