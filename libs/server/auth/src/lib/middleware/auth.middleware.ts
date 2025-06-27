
import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TokenValidationService } from '../services/token-validation.service';
import { accessTokenKey } from '../constants/access-token-key.constant';

@Injectable()
export class AuthMiddleware<TAccessToken> {
  constructor(private authService: TokenValidationService<TAccessToken>) { }

  async use(req: Request, res: Response, next: NextFunction) {
    // todo: put this next line in an injectable service
    if (req.url.includes('/api/') && req.url !== '/api/health') {
      (req as any)[accessTokenKey] = this.authService.validateToken(req.headers?.authorization);
    }

    next();
  }
}
