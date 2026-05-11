import { Request, Response, NextFunction } from 'express';
import { HttpException, HttpStatus } from '@nestjs/common';

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new HttpException(
      'Please Login To Continue',
      HttpStatus.UNAUTHORIZED,
    );
  }
};
