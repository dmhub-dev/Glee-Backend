import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpException,
  HttpStatus,
  Render,
  UploadedFile,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  ForgotPassword,
  PasswordReset,
  RegisterUserDto,
  VerifyOtpDto,
} from './dto/create-auth.dto';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response, ApiResponses } from '@src/common/responses/response';
import {
  ApiImageFile,
  UploadType,
} from '@src/common/decorators/check-mime-type.decorator';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller()
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('thank-you')
  @ApiResponses(false)
  @Render('index.hbs')
  root() {
    return { message: 'Hello world!' };
  }

  @Post('register')
  @ApiResponses(false)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  public async register(
    @Body() createUserDto: RegisterUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    return this.authService.register(createUserDto, file);
  }

  @Post('login')
  @ApiResponses(false)
  public async login(@Body() loginUserDto: LoginDto): Promise<any> {
    const getRole = await this.authService.getRoleByAuth(loginUserDto);
    loginUserDto.role = getRole.role?.name as UserRole;
    if (!loginUserDto.role || loginUserDto.role === UserRole.USER) {
      if (!loginUserDto.playerId)
        throw new HttpException('Player Id is missing', HttpStatus.BAD_REQUEST);
    }
    return await this.authService.login(loginUserDto);
  }

  @Post('refresh')
  @ApiResponses(false)
  public async refresh(@Body() body: { refreshToken: string }): Promise<any> {
    if (!body.refreshToken) {
      throw new HttpException('Refresh token is required', HttpStatus.BAD_REQUEST);
    }
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('forgot-password')
  @ApiResponses(false)
  public async forgotPassword(
    @Body() forgotPasswordDto: ForgotPassword,
    @Req() req,
  ): Promise<any> {
    const result = await this.authService.forgotPassword(forgotPasswordDto);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  @Post('verify-otp')
  @ApiResponses(false)
  public async verifyOtp(@Body() payload: VerifyOtpDto): Promise<any> {
    const result = await this.authService.verifyOtpService(payload);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  @Post('reset-password')
  @ApiResponses(false)
  public async resetPassword(@Body() payload: PasswordReset): Promise<any> {
    const result = await this.authService.resetPassword(payload);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  @Post('user-exists')
  @ApiResponses(false)
  public async userExists(@Body() data: ForgotPassword): Promise<any> {
    const result = await this.authService.userExists(data);
    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }
    return result;
  }

  @Get('logout/:playerId')
  @ApiResponses(true, [UserRole.USER])
  public async logout(
    @CurrentUser() user: any,
    @Param('playerId') playerId: string,
  ): Promise<any> {
    return { success: true };
  }

  @Get('me')
  @ApiResponses(true, [UserRole.USER])
  public async testAuth(@CurrentUser() user: any): Promise<any> {
    return this.authService.testAuth(user);
  }
}
