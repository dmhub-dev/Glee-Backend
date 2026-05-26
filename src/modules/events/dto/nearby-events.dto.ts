import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class NearByEvents {
  @ApiProperty()
  @IsNotEmpty({ message: 'Latitude should be required' })
  latitude: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Longitude should be required' })
  longitude: number;

  @ApiProperty({ required: false })
  @IsOptional()
  // @Min(10,{message:'minmun radius will be 10km'})
  // @Max(100,{message:'Maximum radius will be 100km'})
  radius: number = 15;

  @ApiProperty({ required: false })
  @IsOptional()
  name: string;
}
