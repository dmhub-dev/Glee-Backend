import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateReminderDto, RetrieveRemindersDto, UpdateReminderDto } from './dto/reminder.dto';

@Injectable()
export class ReminderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReminderDto, userId: string) {
    const reminder = await this.prisma.reminder.create({
      data: {
        userId,
        title: dto.title,
        body: dto.body || dto.message,
        scheduledAt: new Date(dto.scheduledAt),
      },
    });

    return { success: true, message: 'Reminder created successfully', data: reminder };
  }

  async findAll(query: RetrieveRemindersDto, userId: string) {
    const { page, limit } = query;
    const where: any = { userId };

    const [data, count] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(count / limit) };
  }

  async findOne(id: string) {
    const reminder = await this.prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw new HttpException('Reminder not found', HttpStatus.NOT_FOUND);
    return { success: true, data: reminder };
  }

  async update(id: string, dto: UpdateReminderDto) {
    const reminder = await this.prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw new HttpException('Reminder not found', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.reminder.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.body && { body: dto.body }),
        ...(dto.scheduledAt && { scheduledAt: new Date(dto.scheduledAt) }),
      },
    });
    return { success: true, data: updated };
  }

  async remove(id: string) {
    await this.prisma.reminder.delete({ where: { id } });
    return { success: true, message: 'Reminder deleted' };
  }
}
