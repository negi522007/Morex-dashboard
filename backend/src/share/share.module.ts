import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicController, ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
  imports: [AuthModule],
  controllers: [ShareController, PublicController],
  providers: [ShareService],
})
export class ShareModule {}
