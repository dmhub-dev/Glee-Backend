import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  AddCommissionDto,
  UserDto,
  UserStatusAndNotificationAdminDto,
} from './dto/admin-users.dto';
import { UserRole, AccountStatus } from '@prisma/client';
import {
  UserProfileUpdateDto,
  UserStatusAndNotificationDto,
} from './dto/user.dto';
import { ConfigService } from '@nestjs/config';
import { loggers } from '@src/interceptors/logger.enums';

const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  country: true,
  profileImage: true,
  role: true,
  vendorId: true,
  notificationStatus: true,
  profileStatus: true,
  haveNewNotification: true,
  isAllChatRead: true,
  margin: true,
};

@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    public configService: ConfigService,
  ) {}

  async addCommission(addCommissionDto: AddCommissionDto, userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { margin: addCommissionDto.commission },
    });

    if (!user) {
      throw new HttpException(
        "Admin doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      msg: 'commission added successfuly',
      data: user.margin,
    };
  }

  async getCommission(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException(
        "Admin doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!user.margin) {
      return {
        success: true,
        msg: "This Admin doesn't set any commission rate yet",
        data: 0,
      };
    }

    return {
      success: true,
      msg: 'commission fetched successfuly',
      data: user.margin,
    };
  }

  async findAll(userQueryDto: UserDto) {
    const where: any = {
      role: { name: UserRole.USER },
      isDeleted: false,
    };

    if (userQueryDto.isDeleted !== undefined) {
      where.isDeleted = userQueryDto.isDeleted;
    }

    if (userQueryDto.status) {
      where.isActive = userQueryDto.status as AccountStatus;
    }

    if (userQueryDto.search) {
      where.OR = [
        { name: { contains: userQueryDto.search, mode: 'insensitive' } },
        { email: { contains: userQueryDto.search, mode: 'insensitive' } },
        { phone: { contains: userQueryDto.search, mode: 'insensitive' } },
      ];
    }

    const [users, docCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { country: true, city: true, state: true },
        skip: (userQueryDto.page - 1) * userQueryDto.limit,
        take: userQueryDto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: users,
      page: userQueryDto.page,
      limit: userQueryDto.limit,
      totalPages: Math.ceil(docCount / userQueryDto.limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { country: true, city: true, state: true },
    });

    return {
      success: true,
      data: user,
    };
  }

  async updateProfile(
    userProfileUpdateDto: UserProfileUpdateDto,
    userId: string,
    file?: Express.Multer.File,
  ) {
    const updateData: any = { ...userProfileUpdateDto };

    if (file) {
      updateData.profileImage = `${this.configService.get('APP_URL')}/upload/${file.filename}`;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { state: true, city: true, country: true },
    });

    loggers.info('updated record......... %O', updatedUser);

    if (!updatedUser) {
      throw new HttpException(
        'There is no user exist with given credentials',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      msg: 'user updated successfuly',
      data: updatedUser,
    };
  }

  async updateStatusAndNotification(
    userStatusAndNotification:
      | UserStatusAndNotificationDto
      | UserStatusAndNotificationAdminDto,
    userId: string,
  ) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: userStatusAndNotification as any,
    });

    if (!updatedUser) {
      throw new HttpException(
        "This user doesn't exist any more",
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      msg: 'status updated successfuly',
      data: updatedUser,
    };
  }

  userExist(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async softDelete(userId: string) {
    const deletedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    if (!deletedUser) {
      throw new HttpException(
        "This is already deleted or doesn't exist",
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      msg: 'Successfuly deleted the user',
      data: deletedUser,
    };
  }

  async remove(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return;
  }

  async uploadImage(file: Express.Multer.File) {
    return {
      success: true,
      data: 'upload/' + file.filename,
    };
  }

  async updateContactInfo(admin: any, _id: string, info: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: admin.id },
    });

    if (!user) {
      throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    }

    const existingContactInfo = Array.isArray(user.adminContactInfo)
      ? (user.adminContactInfo as any[])
      : [];

    const updatedContactInfo = _id
      ? existingContactInfo.map((contact: any) =>
          contact._id === _id || contact.id === _id ? { ...contact, ...info } : contact,
        )
      : [...existingContactInfo, { ...info, _id: `${Date.now()}` }];

    const updated = await this.prisma.user.update({
      where: { id: admin.id },
      data: { adminContactInfo: updatedContactInfo },
    });

    return {
      success: true,
      data: updated.adminContactInfo,
    };
  }

  async deleteContactInfo(admin: any, _id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: admin.id },
    });

    if (!user) {
      throw new HttpException('Admin not found', HttpStatus.NOT_FOUND);
    }

    const updatedContactInfo = ((user.adminContactInfo as any[]) || []).filter(
      (contact: any) => contact.id !== _id,
    );

    const updated = await this.prisma.user.update({
      where: { id: admin.id },
      data: { adminContactInfo: updatedContactInfo },
    });

    return {
      success: true,
      data: updated.adminContactInfo,
    };
  }

  async assignRole(userId: string, roleName: UserRole) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new HttpException(`Role ${roleName} not found`, HttpStatus.BAD_REQUEST);

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: { connect: { id: role.id } } },
      select: { id: true, email: true, role: { select: { name: true } } },
    });
  }
}
