import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MediaType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateMediaDto, MediaQueryDto } from './dto/media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async upload(file: Express.Multer.File, dto: CreateMediaDto, vendorId?: string) {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const type: MediaType = videoExts.includes(ext) ? 'VIDEO' : 'IMAGE';

    const url = `${this.config.get('APP_URL')}/upload/${file.filename}`;
    const media = await this.prisma.media.create({
      data: {
        url,
        type,
        access: dto.access ?? 'PUBLIC',
        vendorId,
      },
    });

    return { success: true, data: media };
  }

  async findAll(query: MediaQueryDto) {
    const where: any = { status: 'ACTIVE' };
    if (query.type) where.type = query.type;
    if (query.vendorId) where.vendorId = query.vendorId;

    const data = await this.prisma.media.findMany({ where, orderBy: { createdAt: 'desc' } });
    return { success: true, data };
  }

  async findOne(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
    return { success: true, data: media };
  }

  async remove(id: string) {
    await this.prisma.media.update({ where: { id }, data: { status: 'INACTIVE' } });
    return { success: true, message: 'Media removed' };
  }
}
