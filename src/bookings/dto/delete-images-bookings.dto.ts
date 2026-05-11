import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class DeleteImageDto {
  @ApiProperty()
  @IsMongoId({ message: 'Provided invalid event id........' })
  @IsNotEmpty({ message: 'Booking id field should not be empty........' })
  bookingId: string;

  @ApiProperty()
  @IsArray()
  @IsNotEmpty({ message: 'Image Url field should not be empty........' })
  imageUrls: string[];
}
