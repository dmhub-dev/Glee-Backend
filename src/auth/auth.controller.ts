import {
    Controller,
    Get,
    Post,
    Body,
    Req,
    Patch,
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
    UpdatePasswordRotationPreferenceDto,
    UpdateTwoFactorPreferenceDto,
    VerifyLoginTwoFactorDto,
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

    @Post('register/verify-otp')
    @ApiResponses(false)
    public async confirmRegistration(
        @Body() payload: VerifyOtpDto,
    ): Promise<any> {
        return this.authService.confirmRegistration(payload);
    }

    @Post('login')
    @ApiResponses(false)
    public async login(@Body() loginUserDto: LoginDto): Promise<any> {
        const getRole = await this.authService.getRoleByAuth(loginUserDto);
        loginUserDto.role = getRole.role?.name as UserRole;
        return await this.authService.login(loginUserDto);
    }

    @Post('login/verify-2fa')
    @ApiResponses(false)
    public async verifyLoginTwoFactor(
        @Body() payload: VerifyLoginTwoFactorDto,
    ): Promise<any> {
        return this.authService.verifyLoginTwoFactor(payload);
    }

    @Patch('me/2fa')
    @ApiResponses(true)
    public async updateTwoFactorPreference(
        @CurrentUser() user: any,
        @Body() payload: UpdateTwoFactorPreferenceDto,
    ): Promise<any> {
        return this.authService.updateTwoFactorPreference(user, payload);
    }

    @Patch('me')
    @ApiResponses(true)
    public async updateMe(
        @CurrentUser() user: any,
        @Body() payload: { firstName?: string; lastName?: string; name?: string; phone?: string; address?: string },
    ): Promise<any> {
        return this.authService.updateMe(user, payload);
    }

    @Post('me/password')
    @ApiResponses(true)
    public async changeMyPassword(
        @CurrentUser() user: any,
        @Body() payload: { currentPassword: string; newPassword: string },
    ): Promise<any> {
        return this.authService.changeMyPassword(user, payload);
    }

    @Patch('me/password-rotation')
    @ApiResponses(true)
    public async updatePasswordRotationPreference(
        @CurrentUser() user: any,
        @Body() payload: UpdatePasswordRotationPreferenceDto,
    ): Promise<any> {
        return this.authService.updatePasswordRotationPreference(user, payload);
    }

    @Post('refresh')
    @ApiResponses(false)
    public async refresh(@Body() body: { refreshToken: string }): Promise<any> {
        if (!body.refreshToken) {
            throw new HttpException(
                'Refresh token is required',
                HttpStatus.BAD_REQUEST,
            );
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
