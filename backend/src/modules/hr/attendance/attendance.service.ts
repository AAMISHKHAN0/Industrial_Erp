import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import {
  buildPagination,
  buildSearchFilter,
} from '../../../common/utils/pagination';
import { enrichWithCreator } from '../../../common/utils/enrich';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAttendanceDto, _userId?: string) {
    return this.prisma.attendance.create({
      data: {
        employeeId: dto.employeeId,
        date: new Date(dto.date),
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        status: (dto.status as any) || 'PRESENT',
        remarks: dto.remarks || undefined,
      },
      include: { employee: true },
    });
  }

  async createBulk(dtos: CreateAttendanceDto[]) {
    return this.prisma.attendance.createMany({
      data: dtos.map((dto) => ({
        employeeId: dto.employeeId,
        date: new Date(dto.date),
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        status: (dto.status as any) || 'PRESENT',
        remarks: dto.remarks || undefined,
      })),
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }) {
    const { page, limit, skip } = buildPagination(query);
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...buildSearchFilter(query.search, ['remarks']),
    };

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { employee: true },
      }),
      this.prisma.attendance.count({ where: where as any }),
    ]);

    const enriched = await enrichWithCreator(this.prisma, data);
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const record = await this.prisma.attendance.findFirst({
      where: { id } as any,
      include: { employee: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    const [enriched] = await enrichWithCreator(this.prisma, [record]);
    return enriched;
  }

  async update(id: string, dto: UpdateAttendanceDto, _userId?: string) {
    await this.findOne(id);
    const data: Record<string, any> = {};
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.clockIn !== undefined)
      data.clockIn = dto.clockIn ? new Date(dto.clockIn) : null;
    if (dto.clockOut !== undefined)
      data.clockOut = dto.clockOut ? new Date(dto.clockOut) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.remarks !== undefined) data.remarks = dto.remarks || null;

    return this.prisma.attendance.update({
      where: { id },
      data,
      include: { employee: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.attendance.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.findOne(id);
  }
}
