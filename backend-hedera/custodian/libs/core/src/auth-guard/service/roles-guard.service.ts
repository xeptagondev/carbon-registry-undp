import { RoleEnum } from '@app/shared/role/enum/role.enum';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuardService implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requireRoles = this.reflector.getAllAndOverride<RoleEnum[]>(
            'roles',
            [context.getHandler(), context.getClass()],
        );

        if (!requireRoles) {
            return true;
        }

        const user = context.switchToHttp().getRequest();
        if (user.userRole) {
            return this.validateRoles([user.userRole], requireRoles);
        }
        return false;
    }

    validateRoles(roles: string[], userRoles: string[]) {
        return roles.some((role) => userRoles.includes(role));
    }
}
