import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Vendor, VendorDocument } from 'src/schemas/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import {
  ticketListingAggregation,
  vendorAggregation,
} from './aggregation/vendor.aggregate';
import {
  RetrieveVendorAdminDto,
  RetrieveVendorDto,
} from '@src/vendor/dto/retrieve.vendor.dto';
import { RegisterVendorDto } from '@src/auth/dto/create-auth.dto';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(Vendor.name)
    private VendorModel: Model<VendorDocument>,
    private readonly configService: ConfigService,
  ) {}

  async create(createVendorDto: CreateVendorDto, file?: Express.Multer.File) {
    let vendorCheck: VendorDocument = await this.VendorModel.findOne({
      email: createVendorDto.email,
    });

    if (vendorCheck) {
      throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
    }
    if (file) {
      createVendorDto.profileImage = `${this.configService.get(
        'APP_URL',
      )}/upload/${file.filename}`;
    }
    const createVendor: VendorDocument = new this.VendorModel(createVendorDto);
    const vendor: VendorDocument = await createVendor.save();
    return {
      success: true,
      message: 'vendor created successfuly!',
      data: vendor,
    };
  }

  async createVendor(registerVendorDto: RegisterVendorDto, file?: Express.Multer.File) {
    let vendorCheck: VendorDocument = await this.VendorModel.findOne({
      email: registerVendorDto.email,
    });

    if (vendorCheck) {
      throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);
    }
    if (file) {
      registerVendorDto.profileImage = `${this.configService.get(
        'APP_URL',
      )}/upload/${file.filename}`;
    }
    const data = {
      name: registerVendorDto.username,
      email: registerVendorDto.email,
      businessAccount:registerVendorDto.bussiness_name,
    };
    return await this.VendorModel.create(data);
  }

  async findAll(filter: RetrieveVendorAdminDto) {
    let query: Partial<FilterQuery<VendorDocument>> = {
      isDeleted: false,
    };
    if (filter.search)
      query.$text = {
        $search: filter.search,
      };

    if (filter.isDeleted) query.isDeleted = filter.isDeleted;
    const vendors: Array<{
      data?: Array<VendorDocument>;
      metadata?: any;
    }> = await this.VendorModel.aggregate(
      vendorAggregation(query, { page: filter.page, limit: filter.limit }),
    );
    if (vendors.length == 0) {
      return {
        success: false,
        message: 'There is currently no vendors',
        data: [],
      };
    }
    return {
      success: true,
      message: 'vendors Fetched Successfuly',
      data: vendors[0]?.data,
      metadata: vendors[0]?.metadata,
      page: filter?.page,
      limit: filter?.limit,
      totalPages: Math.ceil(vendors[0]?.metadata[0]?.total / filter?.limit),
    };
  }

  async ticketListingOfSpecificVendor(vendorId: string, adminId) {
    const tickets: Array<any> = await this.VendorModel.aggregate(
      ticketListingAggregation(vendorId),
    );
    if (tickets.length == 0) {
      return {
        success: false,
        message: 'There is currently no tickets found',
        data: [],
      };
    }
    return {
      success: true,
      message: 'Ticket Fetched Successfully',
      data: tickets,
    };
  }

  async findOne(id: string) {
    const vendor: VendorDocument = await this.VendorModel.findById({
      _id: id,
      isDeleted: false,
    });
    if (!vendor) {
      return {
        success: false,
        message: 'There is no vendor with this id',
        data: [],
      };
    }
    return {
      success: true,
      message: 'vendor Fetched Successfuly',
      data: vendor,
    };
  }

  async getVendor(id: string): Promise<Vendor> {
    const vendor: VendorDocument = await this.VendorModel.findOne({
      _id: id,
      isDeleted: { $eq: false },
    });
    return vendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    const checkVendor: VendorDocument = await this.getVendor(id);
    if (!checkVendor) {
      return {
        success: false,
        message: 'There is no Vendor with this id or already deleted',
        data: [],
      };
    }
    const updatedVendor: Vendor = await this.VendorModel.findByIdAndUpdate(
      id,
      updateVendorDto,
      {
        new: true,
      },
    );

    if (!updatedVendor) {
      return {
        success: false,
        message:
          'There is no vendor with this id or any issues happen during update',
        data: [],
      };
    }
    return {
      success: true,
      message: 'vendor updated Successfuly',
      data: updatedVendor,
    };
  }

  async remove(id: string) {
    const checkVendor = await this.getVendor(id);
    if (!checkVendor) {
      return {
        success: false,
        message: 'There is no Vendor with this id or already deleted',
        data: [],
      };
    }
    if (checkVendor.profileImage) {
      let profile = checkVendor.profileImage.split('/')[4];

      await fs.unlink(`./public/upload/${profile}`, (err) => {
        if (err) {
          throw new HttpException(
            'Currently server is unable to remove these images',
            HttpStatus.FAILED_DEPENDENCY,
          );
        }
      });
    }
    await this.VendorModel.findByIdAndDelete({ _id: id });
    return {
      success: true,
      message: 'This vendor is deleted successfuly',
      data: [],
    };
  }
}
