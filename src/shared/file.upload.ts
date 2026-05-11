import * as multer from 'multer';
import * as fs from 'fs';
import { createFolder } from './utils';
import * as path from 'path';
import { UnsupportedMediaTypeException } from '@nestjs/common';

export const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(path.join(process.cwd(), 'src/public/upload')))
      createFolder('src/public/upload');
    cb(null, 'src/public/upload');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let uploadFile = file.originalname.split('.');
    let name = `${uniqueSuffix}.${uploadFile[uploadFile.length - 1]}`;
    cb(null, name);
  },
});

export function fileMimetypeFilter(mimetypes: string[]) {
  return (
    req,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (mimetypes.some((m) => file.mimetype.includes(m))) {
      callback(null, true);
    } else {
      callback(
        new UnsupportedMediaTypeException(
          `File type is not matching: ${mimetypes.join(', ')}`,
        ),
        false,
      );
    }
  };
}
