import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiParam } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  MulterField,
  MulterOptions,
} from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { storage } from '@src/infrastructure/storage/file-upload.util';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';

export function ApiFiles(
  filedName: string,
  localOptions?: MulterOptions,
  maxCount?: number,
) {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(filedName, 10, {
        storage,
        ...localOptions,
      }),
    ),
  );
}

export function ApiFilesWithMultipleField(
  fields: MulterField[],
  localOptions?: MulterOptions,
  maxCount?: number,
) {
  return applyDecorators(
    UseInterceptors(
      FileFieldsInterceptor(fields, {
        storage,
        ...localOptions,
      }),
    ),
  );
}

export function ApiFile(filedName: string, localOptions?: MulterOptions) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor(filedName, {
        storage,
        ...localOptions,
      }),
    ),
  );
}
