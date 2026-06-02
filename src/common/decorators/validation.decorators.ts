import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function minSpecialCharacter(value: string, min: number) {
  return new RegExp(`[^A-Za-z0-9]{${min}}`, 'g').test(value);
}

function minDigits(value: string, min: number) {
  return new RegExp(`[0-9]{${min}}`, 'g').test(value);
}

function minUpperCase(value: string, min: number) {
  return new RegExp(`[A-Z]{${min}}`, 'g').test(value);
}

function minLowerCase(value: string, min: number) {
  return new RegExp(`[a-z]{${min}}`, 'g').test(value);
}

function isMatchWithPassword(value: string, password: string) {
  return value === password;
}

export function MinSpecialCharacter(
  min: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minSpecialCharacter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return minSpecialCharacter(value, min);
        },
      },
    });
  };
}

export function MinDigits(min: number, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minSpecialCharacter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return minDigits(value, min);
        },
      },
    });
  };
}

export function MinUpperCase(
  min: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minSpecialCharacter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return minUpperCase(value, min);
        },
      },
    });
  };
}

export function MinLowerCase(
  min: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'minSpecialCharacter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, validationArguments?: ValidationArguments) {
          return minLowerCase(value, min);
        },
      },
    });
  };
}

export function IsMatchConfirmPassword(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args?: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return isMatchWithPassword(value, relatedValue);
        },
      },
    });
  };
}
