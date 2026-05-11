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
  Query,
  Param,
  Version,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  ForgotPassword,
  PasswordReset,
  RegisterUserDto,
  VerifyOtpDto,
  RegisterVendorDto,
  LoginVendorDto,
} from './dto/create-auth.dto';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response, ApiResponses } from '../shared/response';
import { CountriesList, CountryCodes } from '../shared/countries';
import { UserMapper } from '../shared/mapper';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import {
  RetrieveCitesDto,
  RetrieveCountriesDto,
  RetrieveStatesDto,
} from '@src/auth/dto/retrieve.dto';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { Role } from '@src/schemas/enums/role';
import { UserDocument } from '@src/schemas/user.shema';

@Controller()
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Route: /thank-you
   */
  @Get('thank-you')
  @ApiResponses(false)
  @Render('index.hbs')
  root() {
    return { message: 'Hello world!' };
  }

  /**
   * Route: /register
   * @param createUserDto
   * @param req
   */
  @Post('register')
  @ApiResponses(false)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  public async register(
    @Body() createUserDto: RegisterUserDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    // validating the country code

    return this.authService.register(createUserDto, file);
  }


  @Version('2')
  @Post('register')
  @ApiResponses(false)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  public async registerV2(
    @Body() registerVendorDto: RegisterVendorDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    // validating the country code

    return this.authService.registerVendor(registerVendorDto, file);
  }

  /**
   * Route: /login
   * @param loginUserDto
   * @param data
   */
  @Post('login')
  @ApiResponses(false)
  public async login(@Body() loginUserDto: LoginDto): Promise<any> {
    const getRole = await this.authService.getRoleByAuth(loginUserDto);
    loginUserDto.role = getRole.role;
    if (!loginUserDto.role || loginUserDto.role === Role.USER) {
      if (!loginUserDto.playerId)
        throw new HttpException('Player Id is missing', HttpStatus.BAD_REQUEST);
    }
    return await this.authService.login(loginUserDto);
  }

  @Version('2')
  @Post('login')
  @ApiResponses(false)
  public async loginV2(@Body() loginVendorDto: LoginVendorDto): Promise<any> {
    if (loginVendorDto.role !== Role.VENDOR) {
        throw new HttpException('Vendor Login', HttpStatus.BAD_REQUEST);
    }
    return await this.authService.loginVendor(loginVendorDto);
  }

  /**
   * Route: /forgot-password
   * @param forgotPasswordDto
   * @param req
   */
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

  /**
   * Route: /verify-otp
   * @param payload
   */
  @Post('verify-otp')
  @ApiResponses(false)
  public async verifyOtp(@Body() payload: VerifyOtpDto): Promise<any> {
    const result = await this.authService.verifyOtpService(payload);

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return result;
  }

  /**
   * Route: /reset-password
   * @param payload
   */
  @Post('reset-password')
  @ApiResponses(false)
  public async resetPassword(@Body() payload: PasswordReset): Promise<any> {
    const result = await this.authService.resetPassword(payload);

    if (!result.success) {
      throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
    }

    return result;
  }

  /**
   * Route: /user-exist
   * @param data
   */
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
  @ApiResponses(true, [Role.USER])
  public async logout(
    @CurrentUser() user,
    @Param('playerId') playerId: string,
  ): Promise<any> {
    console.log('current user.......', user.toObject());
    user.notificationIds.pull(playerId);
    await user.save();
    return {
      success: true,
    };
  }

  /**
   * Route: /me
   * @param req
   */
  @Get('me')
  @ApiResponses(true, [Role.USER])
  // @ApiBearerAuth('access-token')
  // @UseGuards(AuthGuard('jwt'))
  public async testAuth(@CurrentUser() user): Promise<any> {
    return this.authService.testAuth(user);
  }

  @Get('accepted/countries')
  @ApiResponses(false)
  public async getAcceptedCountries(@Query() query: RetrieveCountriesDto) {
    return this.authService.getCountryList(query);
  }

  @Get('accepted/states')
  @ApiResponses(false)
  public async getAcceptedStates(@Query() filter: RetrieveStatesDto) {
    return this.authService.getStateOfCountryList(filter);
  }

  @Get('accepted/cities')
  @ApiResponses(false)
  public async getAcceptedCities(@Query() filter: RetrieveCitesDto) {
    return this.authService.getCitiesOfStateList(filter);
  }
}
