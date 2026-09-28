import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { JournalModule } from '../journal/journal.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [AuthModule, WidgetsModule, JournalModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
