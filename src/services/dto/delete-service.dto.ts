import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class DeleteImageDto {
  @ApiProperty()
  @IsMongoId({ message: 'Provided invalid event id........' })
  @IsNotEmpty({ message: 'Service id field should not be empty........' })
  serviceId: string;

  @ApiProperty()
  @IsArray()
  @IsNotEmpty({ message: 'Image Url field should not be empty........' })
  imageUrls: string[];
}
