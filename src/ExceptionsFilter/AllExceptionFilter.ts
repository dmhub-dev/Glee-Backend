import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { loggers } from '@src/interceptors/logger.enums';

type ResponseObject = {
  message?: string | string[] | any;
  statusCode?: number;
  timestamp?: string;
  path?: string;
  errorStack?: any;
};

type HttpResponse = string | ResponseObject;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    loggers.info(
      'exception response......',
      exception instanceof HttpException && exception.getResponse(),
    );

    let responseBody: ResponseObject = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: 'Internal Server Error',
      errorStack: exception instanceof Error && exception.stack,
    };

    if (exception instanceof HttpException) {
      const response: HttpResponse = exception.getResponse();
      if (typeof response === 'object') {
        responseBody['message'] = response?.message;
      } else {
        responseBody['message'] = exception.message;
      }
    }
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
