import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('SECRETKEY'),
    });
  }

  async validate(payload: {
    id: string;
    name: string;
    email: string;
    role: string;
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isOperationsManager: boolean;
    isCommercialManager: boolean;
    isFinance: boolean;
    isVendor: boolean;
    isVendorStaff: boolean;
    isCustomerSupport: boolean;
    isContentManager: boolean;
    isUser: boolean;
  }): Promise<any> {
    const user: any = await this.authService.validateUser({ userId: payload.id });
    if (!user) throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    if (user.isActive === 'INACTIVE') throw new HttpException('Inactive user', HttpStatus.UNAUTHORIZED);
    return {
      ...user,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      isAdmin: payload.isAdmin,
      isOperationsManager: payload.isOperationsManager,
      isCommercialManager: payload.isCommercialManager,
      isFinance: payload.isFinance,
      isVendor: payload.isVendor,
      isVendorStaff: payload.isVendorStaff,
      isCustomerSupport: payload.isCustomerSupport,
      isContentManager: payload.isContentManager,
      isUser: payload.isUser,
    };
  }
}
