import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmPurchaseDto {
  @IsString()
  @IsNotEmpty()
  verificationToken: string;
}
