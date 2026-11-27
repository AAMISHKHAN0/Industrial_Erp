import { Controller, Get, Res, Optional } from '@nestjs/common';
import { Response } from 'express';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth(@Res() res: Response) {
    if (!this.prisma) {
      return res.status(200).json({
        status: 'ok',
        database: 'unconfigured',
        initialized: false,
      });
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const countResult = await this.prisma.$queryRaw<
        { count: number }[]
      >`SELECT COUNT(*)::int as count FROM users`;
      const userCount = Number(countResult[0]?.count || 0);
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        initialized: userCount > 0,
      });
    } catch (error) {
      return res.status(503).json({
        status: 'error',
        code: 'DB_UNAVAILABLE',
        message:
          error instanceof Error ? error.message : 'Database unavailable',
      });
    }
  }
}
