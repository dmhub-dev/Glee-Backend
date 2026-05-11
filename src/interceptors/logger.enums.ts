import debug from 'debug';

const apiLogger = debug('GLEE-APP:API');
const apiInfo = apiLogger.extend('INFO');
const error = apiLogger.extend('ERROR');
const initLog = debug('GLEE-APP:INIT');
const request = apiLogger.extend('HTTP-REQUEST');
const response = apiLogger.extend('HTTP-RESPONSE');

export enum LoggerEnums {
  REQUEST = 'REQUEST',
}

export const loggers = {
  api: apiLogger,
  initLog,
  info: apiInfo,
  error,
  http: {
    request,
    response,
  },
};
