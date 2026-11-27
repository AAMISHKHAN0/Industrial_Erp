import { Module } from '@nestjs/common';
import { GoodsReceivingNoteController } from './GoodsReceivingNote.controller';
import { GoodsReceivingNoteService } from './GoodsReceivingNote.service';

@Module({
  controllers: [GoodsReceivingNoteController],
  providers: [GoodsReceivingNoteService],
  exports: [GoodsReceivingNoteService],
})
export class GoodsReceivingNoteModule {}
