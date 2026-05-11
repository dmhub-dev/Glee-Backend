import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from 'src/auth/auth.service';
import { AUTHORIZATION_HEADER_KEY, ROLES } from './constants/authentication';

@Injectable()
export class SocketAuthGuard implements CanActivate {
  constructor(
    private _reflector: Reflector,
    private _authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToWs();
    const socket = ctx.getClient<any>();
    const requiredAuthorization = this._reflector.get<string[]>(
      AUTHORIZATION_HEADER_KEY,
      context.getHandler(),
    );
    const roles = this._reflector.get<number[]>(ROLES, context.getHandler());
    return true;
    if (requiredAuthorization) {
      // const SocketData = await this._authService.GetEntityDataBySocketId(
      //   socket.id,
      // );
      const SocketData = {
        roles: 'No User',
      };
      return true;
      //   if (!SocketData) throw new UnauthorizedException();
      //   if (!SocketData.UserType) throw new UnauthorizedException();
      //   if (roles.length && !roles.includes(SocketData.UserType))
      //     throw new UnauthorizedException();

      //   return true;
      // }
      // return true;
    }
  }
}
