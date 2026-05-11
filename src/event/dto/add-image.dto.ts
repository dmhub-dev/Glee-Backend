import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId, IsNotEmpty } from 'class-validator';

export class AddImageDto {
 
    @ApiProperty()
    @IsMongoId({ message: 'Provided invalid event id........' })
    @IsNotEmpty({ message: 'event id field should not be empty........' })
    eventId: string;
 
    @ApiProperty({
    
    name: 'files',
    required:true,
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    }
    
  })
  eventImages: string[];
}

export class DeleteImageDto {
 
    @ApiProperty()
    @IsMongoId({ message: 'Provided invalid event id........' })
    @IsNotEmpty({ message: 'event id field should not be empty........' })
    eventId: string;
 
    @ApiProperty()
    @IsArray()
    @IsNotEmpty({ message: 'Image Url field should not be empty........' })
    imageUrls: string[];
}