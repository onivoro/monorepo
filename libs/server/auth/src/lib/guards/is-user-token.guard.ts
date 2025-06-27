import { IAccessToken } from '@onivoro/isomorphic/common';
import { BadRequestException, CanActivate } from '@nestjs/common';
import { AbstractAuthGuard } from '../classes/abstract-auth-guard.class';

export class IsUserTokenGuard extends AbstractAuthGuard<IAccessToken> implements CanActivate {
    evaluateToken = (token?: IAccessToken) => {
        if (token?.type === 'user') {
            return true;
        }

        throw new BadRequestException('Only available for user-specific tokens.');
    }
}
