import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateLanguageDto, UpdateLanguageDto } from './dto/language.dto';

@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLanguageDto) {
    return this.prisma.language.create({ data: dto });
  }

  async findAll() {
    return this.prisma.language.findMany({ where: { isDeleted: false } });
  }

  async findAllEnabled() {
    return this.prisma.language.findMany({ where: { isDeleted: false, isEnabled: true } });
  }

  async findOne(id: string) {
    const lang = await this.prisma.language.findFirst({ where: { id, isDeleted: false } });
    if (!lang) throw new HttpException('Language not found', HttpStatus.NOT_FOUND);
    return lang;
  }

  async update(id: string, dto: UpdateLanguageDto) {
    const lang = await this.prisma.language.findFirst({ where: { id, isDeleted: false } });
    if (!lang) throw new HttpException('Language not found', HttpStatus.NOT_FOUND);
    return this.prisma.language.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const lang = await this.prisma.language.findFirst({ where: { id, isDeleted: false } });
    if (!lang) throw new HttpException('Language not found', HttpStatus.NOT_FOUND);
    return this.prisma.language.update({ where: { id }, data: { isDeleted: true } });
  }
}
