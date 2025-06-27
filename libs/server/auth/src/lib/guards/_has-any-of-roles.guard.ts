import { RoleEnum } from '@onivoro/server/b2b-orm';
import { IAccessToken } from '@onivoro/isomorphic/common';
import { CanActivate, ForbiddenException } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';

// do not export this from the lib or invoke it directly...
// rather, use a guard-factory to pre-populate the "roles" member via constructor and export the guard-factory
export class _HasAnyOfRolesGuard extends AbstractAuthGuard<IAccessToken> implements CanActivate {
    evaluateToken = (token?: IAccessToken) => {
        const roleId = token?.roleId;

        if (!roleId) {
            return false;
        }

        const isPermitted = !!(this.roles.find(_ => _ === roleId));

        if(!isPermitted) {
            throw new ForbiddenException(`Your current role "${roleId}" has insufficient access to perform this operation.`);
        }

        return isPermitted;
    }

    constructor(public roles: RoleEnum[]) { super(); }
}
