import { IsOptional, IsString } from 'class-validator';

export class ConfirmPurchaseDto {
  @IsString()
  @IsOptional()
  verificationToken?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}
