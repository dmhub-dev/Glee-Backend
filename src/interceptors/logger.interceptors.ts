import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError, tap, catchError } from 'rxjs';
// import { catchError, tap } from 'rxjs/operators';
import { loggers } from '@src/interceptors/logger.enums';
import * as colors from 'colors';

const logHttpRequest = ({ originalUrl, method, params, query, body }) => {
  try {
    loggers.http.request(
      colors.blue(
        '\n-------------------------------------------------------------------------------------',
      ),
    );
    loggers.http.request(
      colors.green('| Method             |   ').bold,
      method,
    );
    loggers.http.request(
      colors.blue('| URL             |   ').bold,
      originalUrl,
    );
    loggers.http.request(
      colors.yellow('| Query             |   %O').bold,
      query,
    );
    loggers.http.request(
      colors.grey('| Params             |   %O').bold,
      params,
    );
    loggers.http.request(
      colors.magenta('| Body             |   %O').bold,
      body,
    );
    loggers.http.request(
      colors.blue(
        '\n-------------------------------------------------------------------------------------',
      ),
    );
  } catch (e) {
    loggers.info('Logger Error', e);
  }
};

const logHttpResponse = ({ originalUrl, method, statusCode, delay, data }) => {
  try {
    loggers.http.response(
      colors.blue(
        '\n-------------------------------------------------------------------------------------',
      ),
    );
    loggers.http.response(
      colors.green('| Method             |   ').bold,
      method,
    );
    loggers.http.response(
      colors.blue('| URL             |   ').bold,
      originalUrl,
    );
    loggers.http.response(
      colors.yellow('| Status Code             |   %O').bold,
      statusCode,
    );
    loggers.http.response(colors.red('| Delay             |   %O').bold, delay);
    loggers.http.response(
      colors.magenta('| Data             |   %O').bold,
      Array.isArray(data) ? [data[0]] : data,
    );
    loggers.http.response(
      colors.blue(
        '\n-------------------------------------------------------------------------------------',
      ),
    );
  } catch (e) {
    loggers.info('Logger Error');
  }
};

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const { originalUrl, method, params, query, body } = req;
    const now = Date.now();
    const url = req.originalUrl;
    logHttpRequest({
      originalUrl,
      method,
      params,
      query,
      body,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          logHttpResponse({
            method,
            data,
            delay,
            statusCode: response.statusCode,
            originalUrl,
          });
        },
        error: (error) => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          logHttpResponse({
            method,
            data: {
              message: error?.message,
              response: error?.response,
            },
            delay,
            statusCode: response.statusCode,
            originalUrl,
          });
          return throwError(error);
        },
      }),
    );
  }
}
