import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    required: true,
    type: 'string',
  })
  @IsOptional()
  @IsString()
  message: string;

  @ApiProperty({
    required: true,
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  to: string;

  @ApiProperty({
    required: true,
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  eventId: string;
}
