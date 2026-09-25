import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [AuthModule, WidgetsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
