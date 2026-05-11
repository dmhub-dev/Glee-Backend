import {
  Injectable,
  HttpException,
  HttpStatus,
  Req,
  OnApplicationBootstrap,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ConfigService } from '@nestjs/config';

import { Countries, CountriesDocument } from '@src/schemas/countries.schema';
import { Cities, CitiesDocument } from '@src/schemas/cities.schema';
import { States, StatesDocument } from '@src/schemas/states.schema';
import mongoose from 'mongoose';
import { loggers } from '@src/interceptors/logger.enums';
import * as STATES_JSON from '@src/shared/all-states-geo-data.json';
import * as CITIES_JSON from '@src/shared/all-cities-geo-data.json';
import * as COUNTRIES_JSON from '@src/shared/all-countries-geo.json';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Countries.name)
    private countriesDocumentModel: Model<CountriesDocument>,
    @InjectModel(Cities.name)
    private citiesDocumentModel: Model<CitiesDocument>,
    @InjectModel(States.name)
    private statesDocumentModel: Model<StatesDocument>,
    public configService: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // this.populateCountriesIfNotExists();
  }

  async populateCountriesIfNotExists(): Promise<void> {
    try {
      const countriesCount = await this.countriesDocumentModel.countDocuments();
      const statesCount = await this.statesDocumentModel.countDocuments();
      const citiesCount = await this.citiesDocumentModel.countDocuments();
      loggers.initLog('COUNTRIES COLLECTION: Countries Count ', countriesCount);
      loggers.initLog('STATES COLLECTION: States Count ', statesCount);
      loggers.initLog('CITIES COLLECTION: Cities Count ', citiesCount);
      if (countriesCount < 1) {
        const data: Array<CountriesDocument> =
          await this.countriesDocumentModel.create(COUNTRIES_JSON as [any], {
            validateBeforeSave: true,
          });
        if (data.length > 0)
          loggers.initLog(
            'COUNTRIES COLLECTION: Countries data is imported successfully',
          );
      } else
        loggers.initLog(
          'COUNTRIES COLLECTION: Countries data is already existed',
        );

      if (statesCount < 1) {
        const data: Array<StatesDocument> =
          await this.statesDocumentModel.create(STATES_JSON as [any], {
            validateBeforeSave: true,
          });
        if (data.length > 0)
          loggers.initLog(
            'STATES COLLECTION: States data is imported successfully',
          );
      } else
        loggers.initLog('STATES COLLECTION: States data is already existed');

      if (citiesCount < 1) {
        const data: Array<CitiesDocument> =
          await this.citiesDocumentModel.create(CITIES_JSON as [any], {
            validateBeforeSave: true,
          });
        if (data.length > 0)
          loggers.initLog(
            'CITIES COLLECTION: Cities data is imported successfully',
          );
      } else
        loggers.initLog('CITIES COLLECTION: Cities data is already existed');
    } catch (e) {
      loggers.error('connection error........ ', e);
    }
  }
}
