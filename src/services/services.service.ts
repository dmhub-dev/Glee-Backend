import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import {
  UpdateServiceDetailsDto,
  UpdateServiceDto,
  UpdateVendorServiceDto,
} from './dto/update-service.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Service, ServiceDocument } from '../schemas/services.schema';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import CategorySeeder from '../seeder/category.seeder';
import { ServiceSeeder } from '../seeder/service.seeder';
import { ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';
import { DeleteImageDto } from './dto/delete-service.dto';
import fs from 'fs';
import { deleteImages } from 'src/shared/utils';
import { ServiceSharedService } from './Shared/shared.services.service';
import { RetrieveServiceAdminDto } from '@src/services/dto/retrieve.service.dto';
import { UserDocument } from '@src/schemas/user.shema';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name)
    private ServiceModel: Model<ServiceDocument>,
    private readonly categorySeeder: CategorySeeder,
    private readonly serviceSeeder: ServiceSeeder,
    private readonly config: ConfigService,
    private readonly sharedService: ServiceSharedService,
  ) {}

  async create(
    createServiceDto: CreateServiceDto,
    files?: Array<Express.Multer.File>,
  ) {
    let photos: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        photos.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      createServiceDto.photos = photos;
    }

    const serviceCreate = {
      ...createServiceDto,
      loc: {
        type: 'Point',
        coordinates: [
          +`${createServiceDto.longitude}`,
          +`${createServiceDto.latitude}`,
        ],
      },
    };
    delete serviceCreate.latitude;
    delete serviceCreate.longitude;
    const createService: ServiceDocument = new this.ServiceModel(serviceCreate);
    const service: ServiceDocument = await createService.save();
    if (!service)
      throw new HttpException(
        'currently not able to create an service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

    return {
      success: true,
      message: 'service created successfuly!',
      data: createService,
    };
  }

  async findAll(
    { page, limit, search, isDeleted }: RetrieveServiceAdminDto,
    user?: UserDocument,
  ) {
    let query: Partial<FilterQuery<ServiceDocument>> = {
      isDeleted: false,
    };
    if (search)
      query.$text = {
        $search: search,
      };
    if (isDeleted) query['isDeleted'] = isDeleted;

    const data: Array<ServiceDocument> = await this.ServiceModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .populate('vendor')
      .sort('-createdAt');
    const docCount: number = await this.ServiceModel.count(query);

    if (!data) {
      return {
        success: true,
        message: 'There is currently no services available',
        data: [],
        haveNewNotification: user.haveNewNotification,
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
      haveNewNotification: user?.haveNewNotification,
    };
  }

  async findAllByVendor(
    { page, limit, search, isDeleted }: RetrieveServiceAdminDto,
    user?: UserDocument,
  ) {
    let query: Partial<FilterQuery<ServiceDocument>> = {
      isDeleted: false,
      vendor:user.vendor_id
    };
    if (search)
      query.$text = {
        $search: search,
      };
    if (isDeleted) query['isDeleted'] = isDeleted;

    const data: Array<ServiceDocument> = await this.ServiceModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .populate('vendor')
      .sort('-createdAt');
    const docCount: number = await this.ServiceModel.count(query);

    if (!data) {
      return {
        success: true,
        message: 'There is currently no services available',
        data: [],
        haveNewNotification: user.haveNewNotification,
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
      haveNewNotification: user?.haveNewNotification,
    };
  }

  async findOne(id: string, query) {
    if (!mongoose.isValidObjectId(id)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }

    const service: ServiceDocument = await this.ServiceModel.findById({
      _id: id,
      ...query,
    })
      .populate('category')
      .populate('vendor');

    if (!service) {
      return {
        success: false,
        message: 'There is no service exists with this id',
        data: {},
      };
    }
    return {
      success: true,
      data: service,
    };
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, files) {
    const query: UpdateQuery<ServiceDocument> = { ...updateServiceDto };

    if (updateServiceDto.latitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.1'] = updateServiceDto.latitude;
    }
    if (updateServiceDto.longitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.0'] = updateServiceDto.longitude;
    }

    const bannerImages: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      delete updateServiceDto.photos;
      query.$push = {
        photos: {
          $each: bannerImages,
        },
      };
    }

    const updatedService: ServiceDocument =
      await this.ServiceModel.findByIdAndUpdate(id, query, {
        new: true,
      });

    if (!updatedService) {
      return {
        success: false,
        message: 'There is no service with this id',
        data: {},
      };
    }
    return {
      success: true,
      message: 'Service updated successfully',
      data: updatedService,
    };
  }

  async updateVendorService(id: string, updateVendorServiceDto: UpdateVendorServiceDto, files) {
    const query: UpdateQuery<ServiceDocument> = { ...updateVendorServiceDto };

    if (updateVendorServiceDto.latitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.1'] = updateVendorServiceDto.latitude;
    }
    if (updateVendorServiceDto.longitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.0'] = updateVendorServiceDto.longitude;
    }

    const bannerImages: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      delete updateVendorServiceDto.photos;
      query.$push = {
        photos: {
          $each: bannerImages,
        },
      };
    }

    const updatedService: ServiceDocument =
      await this.ServiceModel.findByIdAndUpdate(id, query, {
        new: true,
      });

    if (!updatedService) {
      return {
        success: false,
        message: 'There is no service with this id',
        data: {},
      };
    }
    return {
      success: true,
      message: 'Service updated successfully',
      data: updatedService,
    };
  }

  async addAndDeleteServiceDetails(
    id: string,
    updateServiceDetailsDto: UpdateServiceDetailsDto,
  ) {
    let updatedService: ServiceDocument;
    if (
      !updateServiceDetailsDto.addItems &&
      !updateServiceDetailsDto.deleteItems
    ) {
      throw new HttpException(
        'Both the array should not be empty at single call',
        HttpStatus.BAD_REQUEST,
      );
    }
    const checkService: Service = await this.getService(id, false);
    if (!checkService) {
      throw new HttpException(
        'There is no service with this id',
        HttpStatus.NOT_FOUND,
      );
    }

    if (updateServiceDetailsDto.deleteItems) {
      updatedService = await this.ServiceModel.findOneAndUpdate(
        { _id: id },
        { $pullAll: { serviceDetails: updateServiceDetailsDto.deleteItems } },
        { new: true },
      );
    }
    if (updateServiceDetailsDto.addItems) {
      updatedService = await this.ServiceModel.findOneAndUpdate(
        { _id: id },
        {
          $push: {
            serviceDetails: { $each: updateServiceDetailsDto.addItems },
          },
        },
        { new: true },
      );
    }

    if (!updatedService) {
      return {
        success: false,
        msg: 'some error occured while updation',
        data: {},
      };
    }
    return {
      success: true,
      msg: 'Service details is updated',
      data: updatedService,
    };
  }

  async serviceEarning(id: string) {
    if (!mongoose.isValidObjectId(id))
      throw new HttpException(
        { message: 'Invalid reference id provided.', success: false },
        HttpStatus.BAD_REQUEST,
      );

    const result = await this.sharedService.calculateServiceEarning(id);
    if (!Array.isArray(result) || result.length === 0)
      return {
        success: true,
        adminEarning: 0,
        vendorEarning: 0,
      };

    return {
      success: true,
      data: result[0],
    };
  }

  async deleteServiceImages(deleteImagetDto: DeleteImageDto) {

    await deleteImages(deleteImagetDto.imageUrls)
    let updatedService = await this.ServiceModel.findOneAndUpdate(
      { _id: deleteImagetDto.serviceId },
      {
        $pullAll: {
          photos: deleteImagetDto.imageUrls,
        },
      },
      { new: true },
    );

    if (!updatedService) {
      throw new HttpException(
        {
          success: false,
          message: 'Service does not exists',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      success: true,
      message: 'Provided Images urls are deleted successfully..',
      data: updatedService,
    };
  }

  async remove(id: string) {
    const checkService: Service = await this.getService(id, true);
    if (!checkService)
      throw new HttpException(
        'There is no service with this id or already deleted',
        HttpStatus.NOT_FOUND,
      );

    const serviceData: Service = await this.ServiceModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );
    return;
  }

  async getService(id: string, alreayDelted: boolean): Promise<Service> {
    let query: FilterQuery<ServiceDocument>;
    if (alreayDelted) {
      query = { isDeleted: false };
    }

    const service: ServiceDocument = await this.ServiceModel.findOne({
      _id: id,
      ...query,
    });
    return service ? service : null;
  }

  async removePermanent(id: string): Promise<any> {
    const checkService: Service = await this.getService(id, false);
    if (!checkService) {
      throw new HttpException(
        'There is no service with this id or already deleted',
        HttpStatus.NOT_FOUND,
      );
    }
    if (checkService.photos.length > 0) {
      await deleteImages(checkService.photos);
    }
    // await this.serviceBuyerModel.deleteMany({ serviceId: id });
    await this.ServiceModel.findByIdAndDelete({ _id: id });
    return;
  }

  async dbDataFiller() {
    let filledData = await this.serviceSeeder.createDummyEvents();
    return {
      success: true,
      filledData,
    };
  }

  async clearEventCL() {
    await this.ServiceModel.deleteMany({});
    return {
      success: true,
    };
  }
}
