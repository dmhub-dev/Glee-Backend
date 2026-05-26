import { Body, Controller, Post, Req, Res, Headers } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiResponses } from '@src/common/responses/response';
import { PaystackVerifyTransactionDto } from './dto/paystack.dto';
import { PayStackService } from './paystack.service';
import { AllowAny } from '@src/auth/jwt/jwt-auth.guard';

@ApiTags('Paystack')
@Controller('paystack')
export class PayStackController {
  constructor(private readonly payStackService: PayStackService) {}

  @AllowAny()
  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Res() res: Response,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const isValid = this.payStackService.verifySignature(req.rawBody ?? Buffer.from(JSON.stringify(req.body)), signature);
    if (!isValid) return res.status(401).send('Invalid signature');
    await this.payStackService.processWebhookEvent(req.body);
    return res.sendStatus(200);
  }

  @ApiResponses(false)
  @Post('verify-transaction')
  async verifyTransaction(@Body() payload: PaystackVerifyTransactionDto) {
    return this.payStackService.verifyTransaction(payload.token);
  }
}
