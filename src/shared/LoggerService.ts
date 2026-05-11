import { LoggerService } from '@nestjs/common';
import debug from 'debug';
import { loggers, LoggerEnums } from '@src/interceptors/logger.enums';

// var colors = require('colors');

export class MyLogger implements LoggerService {
  /**
   * Write a 'log' level log.
   */
  log(message: any, ...optionalParams: any[]) {
    if (typeof optionalParams[0] === 'string') loggers.initLog(message);
    else loggers.info(message);
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, ...optionalParams: any[]) {}

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, ...optionalParams: any[]) {}

  /**
   * Write a 'debug' level log.
   */
  debug?(message: any, ...optionalParams: any[]) {}

  /**
   * Write a 'verbose' level log.
   */
  verbose?(message: any, ...optionalParams: any[]) {}

  /**
   * Write a 'verbose' level log.
   */
  requestLog?(message: any, ...optionalParams: any[]) {}
}
