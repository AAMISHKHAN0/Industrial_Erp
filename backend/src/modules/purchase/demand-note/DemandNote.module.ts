import { Module } from '@nestjs/common';
import { DemandNoteController } from './DemandNote.controller';
import { DemandNoteService } from './DemandNote.service';

@Module({
  controllers: [DemandNoteController],
  providers: [DemandNoteService],
  exports: [DemandNoteService],
})
export class DemandNoteModule {}
