import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@ApiTags('Backups')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get()
  list() {
    return this.service.listBackups();
  }

  @Post('create')
  async create() {
    const filename = await this.service.createBackup(true);
    return { filename, message: 'Backup created successfully' };
  }

  @Get('download/:id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const b = await this.service.getBackupById(id);
    const raw = JSON.stringify(b.data, null, 2);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${b.filename}"`,
      'Content-Length': String(raw.length),
    });
    res.send(raw);
  }

  @Post('restore/:id')
  async restore(@Param('id') id: string) {
    const total = await this.service.restoreBackup(id);
    return { message: `Restored successfully (${total} records)` };
  }

  @Post('upload')
  async upload(@Body() body: any) {
    const raw = typeof body === 'string' ? JSON.parse(body) : body;
    if (!raw || !raw.models)
      throw new BadRequestException('Invalid backup — missing "models" key');
    const json = JSON.stringify(raw);
    const filename = `backup-uploaded-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const b = await (this.service as any).prisma.backup.create({
      data: { filename, label: 'uploaded', size: json.length, data: raw },
    });
    await this.service.restoreBackup(b.id);
    return { message: 'Backup uploaded and restored' };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.deleteBackup(id);
    return { message: 'Backup deleted' };
  }

  @Delete()
  async clearAll() {
    await this.service.clearAllData();
    return { message: 'All data cleared' };
  }
}
