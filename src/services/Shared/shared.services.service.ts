import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  PurchasedService,
  PurchasedServiceDocument,
} from 'src/schemas/purchased-service.schema';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from 'src/schemas/services.schema';
import { aggregateEventEarning } from '../../event/event-tickets/aggregations/aggregation.event-ticket';
import { aggregateServiceEarning } from '../purchased-service/aggregations/aggregation.service-ticket';

@Injectable()
export class ServiceSharedService {
  constructor(
    @InjectModel(Service.name)
    private ServiceModel: Model<ServiceDocument>,
    @InjectModel(PurchasedService.name)
    private readonly PurchasedServiceModel: Model<PurchasedServiceDocument>,
  ) {}

  async helperServiceFindById(_id: string) {
    return this.ServiceModel.findById(_id).populate({
      path: 'vendor',
      select: { email: 1 },
    });
  }

  async calculateServiceEarning(id) {
    return this.PurchasedServiceModel.aggregate(aggregateServiceEarning(id));
  }
}
