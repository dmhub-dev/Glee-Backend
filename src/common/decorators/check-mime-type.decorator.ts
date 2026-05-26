import {
  ApiFile,
  ApiFiles,
  ApiFilesWithMultipleField,
} from './file-upload-api.decorator';
import { InternalServerErrorException } from '@nestjs/common';
import { fileMimetypeFilter } from '@src/infrastructure/storage/file-upload.util';
import { MulterField } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export enum UploadType {
  SINGLE = 'single',
  ARRAY = 'array',
  MULTIPLE = 'multiple',
}

export function ApiImageFile(
  fieldName: string,
  options: {
    maxCount?: number;
    type: UploadType;
    fields?: MulterField[];
  },
) {
  let mimeTypes = ['jpeg', 'jpg', 'png'];
  if (options.type === UploadType.ARRAY)
    return ApiFiles(
      fieldName,
      {
        fileFilter: fileMimetypeFilter(mimeTypes),
      },
      options.maxCount || 10,
    );
  else if (options.type === UploadType.SINGLE)
    return ApiFile(fieldName, {
      fileFilter: fileMimetypeFilter(mimeTypes),
    });
  else if (options.type === UploadType.MULTIPLE) {
    return ApiFilesWithMultipleField(options.fields, {
      fileFilter: fileMimetypeFilter(mimeTypes),
    });
  } else
    throw new InternalServerErrorException(
      'Invalid Option Provided to Decorator............',
    );
}
