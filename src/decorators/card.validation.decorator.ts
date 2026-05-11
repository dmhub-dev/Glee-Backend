// noinspection DuplicatedCode

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  isPostalCode,
} from 'class-validator';
import * as moment from 'moment';
import { CountryCodes } from '../shared/countries';

function isCountryCode(value) {
  if (!new RegExp('[a-zA-Z]{2}', 'g').test(value)) return false;

    return CountryCodes.includes(`${value}`.toLowerCase());
}

export function IsExpMonthYear(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidExpMonth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          let expYearRegEx = new RegExp('[0-9]{2}/[0-9]{2}', 'g');
          if (!expYearRegEx.test(value)) {
            validationOptions.message =
              'Invalid exp pattern. It should be like this "mm/yy"';

            return false;
          }
          return moment(`${value}`, 'MM/YY').isSameOrAfter(moment());
        },
      },
    });
  };
}

export function IsCVC(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidExpMonth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return new RegExp('[0-9]{3}', 'g').test(value);
        },
      },
    });
  };
}

export function IsCountryCode(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidExpMonth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return isCountryCode(value);
        },
      },
    });
  };
}

export function IsCustomizePostalCode(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidExpMonth',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args?: ValidationArguments) {
          try {
            const [relatedPropertyName] = args.constraints;
            const relatedValue = (args.object as any)[relatedPropertyName];
            if (!isCountryCode(relatedValue)) {
              return false;
            }
            return isPostalCode(value, relatedValue);
          } catch (e) {
            return false;
          }
        },
      },
    });
  };
}
