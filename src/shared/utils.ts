import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { loggers } from '@src/interceptors/logger.enums';
const algorithm = 'aes-256-ctr';
const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';
const iv = crypto.randomBytes(16);

export const comparePasswords = async (userPassword, currentPassword) => {
  return await bcrypt.compare(currentPassword, userPassword);
};

export const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return {
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
  };
};

export const decrypt = (hash) => {
  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(hash.iv, 'hex'),
  );

  const decrpyted = Buffer.concat([
    decipher.update(Buffer.from(hash.content, 'hex')),
    decipher.final(),
  ]);

  return decrpyted.toString();
};

export const getCurrentDate = () => {
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  var yyyy = today.getFullYear();

  return `${yyyy}-${mm}-${dd}`;
};

export const createFolder = (name?: string): void => {
  // Create folder for uploading files.]
  const filesDir = path.join(process.cwd(), name || 'uploads');
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir);
  }
};

export const deleteImages = async (imageUrls: string[]) => {
  try {
    imageUrls.map(async (image): Promise<void> => {
      let photo = image.split('/')[4];
      let filePath = path.join('', 'upload', photo);
      if (fs.existsSync(filePath)) {
        await fsAsync.unlink(filePath);
      }
    });
  } catch (error) {
    throw new HttpException(
      'Some issues occurred while deleting the images',
      HttpStatus.FAILED_DEPENDENCY,
    );
  }
};

const nestedObjects = (data) => {
  const dataInArray = [];

  return dataInArray;
};

// const getJsonData = () =>
//   new Promise((resolve, reject) => {
//     // let updatedStructure = [];
//     //
//     // Object.keys([]).map((v) => {
//     //   const data = allCities[v];
//     //   if (Array.isArray(data))
//     //     data.map((dataToPush) => updatedStructure.push(dataToPush));
//     //   else if (typeof data === 'object') {
//     //     Object.keys(data).map((v) => {
//     //       const actualData = data[v];
//     //       if (Array.isArray(actualData)) {
//     //         actualData.map((dataToPush) => updatedStructure.push(dataToPush));
//     //       } else if (typeof actualData === 'object') {
//     //         Object.keys(actualData).map((z) => {
//     //           const nestedData = actualData[z];
//     //           if (Array.isArray(nestedData)) {
//     //             nestedData.map((dataToPush) =>
//     //               updatedStructure.push(dataToPush),
//     //             );
//     //           }
//     //         });
//     //       }
//     //     });
//     //   }
//     });
//
//     //
//     // if (!updatedStructure) reject('unexpected...');
//     // else {
//     //   resolve(updatedStructure);
//     // }
//   });

export const populateStateData = async () => {
  try {
    const updatedStructure = [];
    const jsonFormatData = JSON.stringify(updatedStructure);
    // if (jsonFormatData)
    //   fs.writeFile(
    //     './all-cities-geo-data.json',
    //     jsonFormatData,
    //     {},
    //     (error) => {
    //     },
    //   );
  } catch (e) {
    loggers.info('error ............', e);
  }
};

export const generateOtp = (): number =>
  Math.floor(1000 + Math.random() * 9000);

export const getArray = (arr) => (Array.isArray(arr) ? arr : []);

export type numstring = string | number;
