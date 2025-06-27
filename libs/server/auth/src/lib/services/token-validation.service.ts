import jwt from 'jsonwebtoken';
import { Injectable } from "@nestjs/common";
import { ServerAuthConfig } from '../classes/server-auth-config.class';

@Injectable()
export class TokenValidationService<IAccessToken> {

  validateToken(authHeaderValue?: string): IAccessToken | null {
    if (!authHeaderValue) {
      return null;
    }

    try {
      return (jwt.verify(authHeaderValue?.replace('Bearer ', ''), this.config.JWT_SECRET) as any) || null;
    } catch (e) {
      return null;
    }
  }

  constructor(private config: ServerAuthConfig) { }
}