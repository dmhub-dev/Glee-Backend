import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionKey } from './permissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionKey[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Permissions() decorator → allow (auth already handled by JwtAuthGuard)
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (user?.role === 'SUPER_ADMIN' || user?.isSuperAdmin) return true;
    if (!user || !Array.isArray(user.permissions)) return false;

    return required.every(p => (user.permissions as string[]).includes(p));
  }
}
