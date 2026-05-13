import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import {
  Injectable,
  HttpException,
  HttpStatus,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
// import { JwtPayload } from './interfaces/payload.interface';
import { RegisterUserDto } from './dto/create-auth.dto';
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

  async validate(payload: { userId: string; email: string; permissions: string[] }): Promise<any> {
    const user: any = await this.authService.validateUser(payload);
    if (user.isActive === 'INACTIVE') {
      throw new HttpException('Inactive user', HttpStatus.UNAUTHORIZED);
    }
    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
    // Attach permissions from the JWT payload to the request user object
    return { ...user, permissions: payload.permissions ?? [] };
  }
}

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
