import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { Booking, BookingDocument } from 'src/schemas/booking.schema';
import {
  CreateBookingDto,
  CreateBookingTableDto,
  CreateVendorBookingDto,
  TablesDto,
} from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingTableDto,
  VendorUpdateBookingDto,
} from './dto/update-booking.dto';
import * as mongoose from 'mongoose';
import {
  BookingTable,
  BookingTableDocument,
} from 'src/schemas/booking-table.schema';
import { DeleteImageDto } from './dto/delete-images-bookings.dto';
import { deleteImages } from 'src/shared/utils';
import { RetrieveBookingAdminDto } from '@src/bookings/dto/retrieve-bookings.dto';
import { BookingSharedService } from '@src/bookings/shared/shared.bookings.service';
import * as moment from 'moment';
@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name)
    private bookingModel: Model<BookingDocument>,
    @InjectModel(BookingTable.name)
    private bookingTableModel: Model<BookingTableDocument>,
    private readonly config: ConfigService,
    private readonly bookingSharedService: BookingSharedService,
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    files?: Array<Express.Multer.File>,
  ) {
    // createBookingDto.tables = JSON.parse(createBookingDto.tables);

    let photos: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        photos.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      createBookingDto.photos = photos;
    }
    const bookingCreate = {
      ...createBookingDto,
      loc: {
        type: 'Point',
        coordinates: [
          +`${createBookingDto.longitude}`,
          +`${createBookingDto.latitude}`,
        ],
      },
    };
    delete bookingCreate.latitude;
    delete bookingCreate.longitude;
    const booking: BookingDocument = await this.bookingModel.create(
      bookingCreate,
    );
    if (!booking)
      throw new HttpException(
        'currently not able to create an service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    return {
      success: true,
      message: 'booking created successfuly!',
      data: booking,
    };
  }

  async createVendorBooking(
    createVendorBookingDto: CreateVendorBookingDto,
    files?: Array<Express.Multer.File>,
  ) {
    // createBookingDto.tables = JSON.parse(createBookingDto.tables);

    let photos: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        photos.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      createVendorBookingDto.photos = photos;
    }
    const bookingCreate = {
      ...createVendorBookingDto,
      loc: {
        type: 'Point',
        coordinates: [
          +`${createVendorBookingDto.longitude}`,
          +`${createVendorBookingDto.latitude}`,
        ],
      },
    };
    delete bookingCreate.latitude;
    delete bookingCreate.longitude;
    const booking: BookingDocument = await this.bookingModel.create(
      bookingCreate,
    );
    if (createVendorBookingDto.vendorTables.length > 0) {
      for (let index = 0; index < createVendorBookingDto.vendorTables.length; index++) {
        Object.assign(createVendorBookingDto.vendorTables[index], { bookingId: booking._id });
      }
      const vendorTableAdd = await this.createVendorTables(createVendorBookingDto.vendorTables);
    }
    
    
    if (!booking)
      throw new HttpException(
        'currently not able to create an service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    return {
      success: true,
      message: 'booking created successfuly!',
      data: booking,
    };
  }

  async createVendorTables(data) {
    let table = await this.bookingTableModel.create(data);
    return {
      success: true,
      message: 'table created successfuly!',
      data: table,
    };
  }

  async createTables(body: CreateBookingTableDto) {
    // if (!mongoose.isValidObjectId(createBookingTableDto.bookingId)) {
    //   throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    // }

    let table = await this.bookingTableModel.create(body.tables);
    return {
      success: true,
      message: 'table created successfuly!',
      data: table,
    };
  }

  async updateTables(id: string, updateBookingTableDto: UpdateBookingTableDto) {
    if (!mongoose.isValidObjectId(id)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }
    let table = await this.bookingTableModel.findOneAndUpdate(
        {_id: id},
        updateBookingTableDto,
        {new: true},
    );
    return {
      success: true,
      message: 'table data updated successfuly!',
      data: table,
    };
  }

  async deleteBookingTable(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }
    let table = await this.bookingTableModel.findOneAndUpdate(
        {_id: id},
        {isDeleted: true},
        {new: true},
    );
    return {
      success: true,
      message: 'table data updated successfuly!',
      data: table,
    };
  }

  async findAll(
      {page, limit, isDeleted, search}: RetrieveBookingAdminDto,
      isAdmin?: boolean,
  ) {
    let query: Partial<FilterQuery<BookingDocument>> = {
      isDeleted: false,
    };
    if (isDeleted) query.isDeleted = isDeleted;

    if (isAdmin === false) {
      query.startTime = {
        $gte: moment().toDate(),
      };
      query.endTime = {
        $gte: moment().toDate(),
      };
    }

    if (search)
      query.$text = {
        $search: search,
      };
    const data: Array<BookingDocument> = await this.bookingModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .populate('vendor')
      .sort('-createdAt');
    const docCount: number = await this.bookingModel.count();

    if (!data) {
      return {
        success: true,
        message: 'There is currently no booking available',
        data: [],
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
    };
  }


  async findAllByVendorId({page, limit, isDeleted, search}: RetrieveBookingAdminDto,user) {
    let query: Partial<FilterQuery<BookingDocument>> = {
      isDeleted: false,
      vendor:user.vendor_id
    };
    if (isDeleted) query.isDeleted = isDeleted;

    // if (isAdmin === false) {
    //   query.startTime = {
    //     $gte: moment().toDate(),
    //   };
    //   query.endTime = {
    //     $gte: moment().toDate(),
    //   };
    // }

    if (search)
      query.$text = {
        $search: search,
      };
    const data: Array<BookingDocument> = await this.bookingModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .populate('vendor')
      .sort('-createdAt');
    const docCount: number = await this.bookingModel.count();

    if (!data) {
      return {
        success: true,
        message: 'There is currently no booking available',
        data: [],
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
    };
  }

  async findOne(id: string, query) {
    if (!mongoose.isValidObjectId(id)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }
    const booking: BookingDocument = await this.bookingModel
      .findById({
        _id: id,
        ...query,
      })
      .populate('category')
      .populate('vendor');

    const tableData: Array<BookingTableDocument> =
      await this.bookingTableModel.find({
        bookingId: id,
        isDeleted: false,
      });

    if (!booking) {
      return {
        success: false,
        message: 'There is no booking exists with this id',
        data: {},
      };
    }
    return {
      success: true,
      data: { booking, tableData },
    };
  }

  async bookingEarningService(id: string) {
    if (!mongoose.isValidObjectId(id))
      throw new HttpException(
        { message: 'Invalid reference id provided.', success: false },
        HttpStatus.BAD_REQUEST,
      );

    const result = await this.bookingSharedService.calculateBookingsEarning(id);
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

  async getTables(id) {
    if (!mongoose.isValidObjectId(id)) {
      throw new HttpException('Invalid Request data', HttpStatus.BAD_REQUEST);
    }
    const tables: BookingTableDocument[] = await this.bookingTableModel.find({
      bookingId: id,
      isBooked: false,
      isDeleted: false,
    });

    if (!tables) {
      return {
        success: false,
        message: 'There is no tables found on this booking',
        data: [],
      };
    }
    return {
      success: true,
      data: tables,
    };
  }

  async update(
    id: string,
    updateBookingDto: UpdateBookingDto,
    files?: Array<Express.Multer.File>,
  ) {
    const query: mongoose.UpdateQuery<BookingDocument> = {
      ...updateBookingDto,
    };

    if (updateBookingDto.latitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.1'] = updateBookingDto.latitude;
    }
    if (updateBookingDto.longitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.0'] = updateBookingDto.longitude;
    }

    const bannerImages: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      delete updateBookingDto.photos;
      query.$push = {};
      query.$push['photos'] = {
        $each: bannerImages,
      };
      delete query.photos;
    }

    // if (
    //   updateBookingDto.detailsAddItems &&
    //   !updateBookingDto.detailsDeleteItems
    // ) {
    //   if (updateBookingDto.detailsAddItems) {
    //   }
    //   query.$push['bookingDetails'] = {
    //     $each: updateBookingDto.detailsAddItems,
    //   };
    //   delete query.detailsAddItems;
    // } else if (
    //   !updateBookingDto.detailsAddItems &&
    //   updateBookingDto.detailsDeleteItems
    // ) {
    //   query.$pullAll = {};
    //   query.$pullAll['bookingDetails'] = updateBookingDto.detailsDeleteItems;
    //   delete query.detailsDeleteItems;
    // } else if (
    //   updateBookingDto.detailsAddItems &&
    //   updateBookingDto.detailsDeleteItems
    // ) {

    //   await this.bookingModel.findOneAndUpdate(
    //     { _id: id },
    //     { $pullAll: { bookingDetails: updateBookingDto.detailsDeleteItems } },
    //   );
    //   query.$push.bookingDetails = {
    //     $each: updateBookingDto.detailsAddItems,
    //   };
    //   delete query.detailsDeleteItems;
    //   delete query.detailsAddItems;
    // }
    const updatedBooking: BookingDocument =
      await this.bookingModel.findByIdAndUpdate(id, query, {
        new: true,
      });
    if (!updatedBooking) {
      return {
        success: false,
        message: 'There is no booking with this id',
        data: {},
      };
    }
    return {
      success: true,
      message: 'boooking updated successfully',
      data: updatedBooking,
    };
  }

  async vendorUpdateBookingDto(
    id: string,
    vendorUpdateBookingDto: VendorUpdateBookingDto,
    files?: Array<Express.Multer.File>,
  ) {
    const query: mongoose.UpdateQuery<BookingDocument> = {
      ...vendorUpdateBookingDto,
    };

    if (vendorUpdateBookingDto.latitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.1'] = vendorUpdateBookingDto.latitude;
    }
    if (vendorUpdateBookingDto.longitude) {
      query['loc.type'] = 'Point';
      query['loc.coordinates.0'] = vendorUpdateBookingDto.longitude;
    }

    const bannerImages: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      delete vendorUpdateBookingDto.photos;
      query.$push = {};
      query.$push['photos'] = {
        $each: bannerImages,
      };
      delete query.photos;
    }
    const updatedBooking: BookingDocument =
      await this.bookingModel.findByIdAndUpdate(id, query, {
        new: true,
      });
      if (vendorUpdateBookingDto.vendorTables.length > 0) {
        for (let index = 0; index < vendorUpdateBookingDto.vendorTables.length; index++) {
          Object.assign(vendorUpdateBookingDto.vendorTables[index], { bookingId:id });
        }
        const vendorTableAdd = await this.updateVendorTables(id,vendorUpdateBookingDto.vendorTables);
      }
    
    if (!updatedBooking) {
      return {
        success: false,
        message: 'There is no booking with this id',
        data: {},
      };
    }
    return {
      success: true,
      message: 'boooking updated successfully',
      data: updatedBooking,
    };
  }

  async updateVendorTables(id: string, data) {
    const tables: BookingTableDocument[] = await this.bookingTableModel.find({
      bookingId: id,
      isBooked: false,
      isDeleted: false,
    });
    if (tables.length > 0) {
      for (let index = 0; index < tables.length; index++) {
        await this.bookingTableModel.findOneAndDelete({ bookingId: id });
      }
    }
    // await this.bookingTableModel.findOneAndDelete({ bookingId: id });
    let table = await this.bookingTableModel.create(data);
    return {
      success: true,
      message: 'table created successfuly!',
      data: table,
    };
  }

  async getBooking(id: string, alreayDelted: boolean): Promise<Booking> {
    let query: FilterQuery<BookingDocument>;
    if (alreayDelted) {
      query = { isDeleted: false };
    }

    const booking: BookingDocument = await this.bookingModel.findOne({
      _id: id,
      ...query,
    });
    return booking ? booking : null;
  }

  async deleteBookingImages(deleteImagetDto: DeleteImageDto) {
    await deleteImages(deleteImagetDto.imageUrls);

    let updatedBooking = await this.bookingModel.findOneAndUpdate(
      { _id: deleteImagetDto.bookingId },
      {
        $pullAll: {
          photos: deleteImagetDto.imageUrls,
        },
      },
      { new: true },
    );

    if (!updatedBooking) {
      throw new HttpException(
        {
          success: false,
          message: 'booking does not exists',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      success: true,
      message: 'Provided Images urls are deleted successfully..',
      data: updatedBooking,
    };
  }

  async remove(id: string) {
    const checkBooking: Booking = await this.getBooking(id, true);
    if (!checkBooking)
      throw new HttpException(
        'There is no booking with this id or already deleted',
        HttpStatus.NOT_FOUND,
      );

    await this.bookingModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );
    return;
  }

  async removePermanent(id: string): Promise<null> {
    const checkBooking: Booking = await this.getBooking(id, false);
    if (!checkBooking) {
      throw new HttpException(
        'There is no booking with this id or already deleted',
        HttpStatus.NOT_FOUND,
      );
    }
    if (checkBooking.photos.length > 0) {
      await deleteImages(checkBooking.photos);
    }
    await this.bookingModel.findByIdAndDelete({ _id: id });
    return;
  }

  async removePermanentVendor(id: string): Promise<null> {
    const checkBooking: Booking = await this.getBooking(id, false);
    if (!checkBooking) {
      throw new HttpException(
        'There is no booking with this id or already deleted',
        HttpStatus.NOT_FOUND,
      );
    }
    const tables: BookingTableDocument[] = await this.bookingTableModel.find({
      bookingId: id,
      isBooked: false,
      isDeleted: false,
    });
    if (tables.length > 0) {
      for (let index = 0; index < tables.length; index++) {
        await this.bookingTableModel.findOneAndDelete({ bookingId: id });
      }
    }
    if (checkBooking.photos.length > 0) {
      await deleteImages(checkBooking.photos);
    }
    await this.bookingModel.findByIdAndDelete({ _id: id });
    
    return;
  }
}
