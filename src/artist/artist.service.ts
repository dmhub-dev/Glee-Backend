import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateArtistDto, RetrieveArtistDto, UpdateArtistDto } from './dto/artist.dto';

@Injectable()
export class ArtistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private fileUrl(filename: string) {
    return `${this.config.get('APP_URL')}/upload/${filename}`;
  }

  async create(dto: CreateArtistDto, files: { profileImage?: Express.Multer.File; images?: Express.Multer.File[]; videos?: Express.Multer.File[] }) {
    const data: any = { name: dto.name, eventId: dto.eventId };

    if (files?.profileImage) data.profileImage = this.fileUrl(files.profileImage.filename);
    if (files?.images?.length) data.images = files.images.map(f => this.fileUrl(f.filename));
    if (files?.videos?.length) data.videos = files.videos.map(f => this.fileUrl(f.filename));

    const artist = await this.prisma.artist.create({ data });
    return { message: 'Artist created successfully', data: artist };
  }

  async findAll(query: RetrieveArtistDto) {
    const { search, page, limit, eventId } = query;
    const where: any = { isDeleted: false };
    if (eventId) where.eventId = eventId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.artist.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.artist.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(docCount / limit) };
  }

  async findOne(id: string) {
    const data = await this.prisma.artist.findUnique({ where: { id } });
    if (!data) throw new HttpException('Artist not found', HttpStatus.NOT_FOUND);
    return { data };
  }

  async update(id: string, dto: UpdateArtistDto, files: { profileImage?: Express.Multer.File; images?: Express.Multer.File[]; videos?: Express.Multer.File[] }) {
    const updateData: any = { ...dto };
    delete updateData.profileImage;
    delete updateData.images;
    delete updateData.videos;

    if (files?.profileImage) updateData.profileImage = this.fileUrl(files.profileImage.filename);

    const existing = await this.prisma.artist.findUnique({ where: { id } });
    if (!existing) throw new HttpException('Artist not found', HttpStatus.NOT_FOUND);

    if (files?.images?.length) {
      updateData.images = [...(existing.images || []), ...files.images.map(f => this.fileUrl(f.filename))];
    }
    if (files?.videos?.length) {
      updateData.videos = [...(existing.videos || []), ...files.videos.map(f => this.fileUrl(f.filename))];
    }

    const data = await this.prisma.artist.update({ where: { id }, data: updateData });
    return { message: 'Artist updated successfully', data };
  }

  async remove(id: string) {
    await this.prisma.artist.update({ where: { id }, data: { isDeleted: true } });
    return { message: 'Artist deleted successfully' };
  }

  async deleteImages(artistId: string, urls: string[]) {
    const existing = await this.prisma.artist.findUnique({ where: { id: artistId } });
    if (!existing) throw new HttpException('Artist not found', HttpStatus.NOT_FOUND);

    await this.prisma.artist.update({
      where: { id: artistId },
      data: {
        images: existing.images.filter(img => !urls.includes(img)),
        videos: existing.videos.filter(vid => !urls.includes(vid)),
      },
    });

    return { success: true, message: 'Media deleted successfully' };
  }
}
