import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as xrayExpress from 'aws-xray-sdk-express';
import { ServerAwsObservabilityConfig } from '../aws-observability-config.interface';
import { SERVER_AWS_OBSERVABILITY_CONFIG } from '../aws-observability.constants';

@Injectable()
export class XrayMiddleware implements NestMiddleware {
  private readonly openSegment: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  constructor(
    @Inject(SERVER_AWS_OBSERVABILITY_CONFIG)
    private readonly config: ServerAwsObservabilityConfig,
  ) {
    this.openSegment = xrayExpress.openSegment(
      config.xray?.segmentName ?? config.serviceName,
    );
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.config.xray?.enabled === false || this.isExcluded(req.path)) {
      next();
      return;
    }

    this.openSegment(req, res, next);
  }

  /** Paths are matched against the full request path, including any global prefix. */
  private isExcluded(path: string): boolean {
    return (this.config.xray?.excludePaths ?? []).some(
      (excluded) => path === excluded || path.startsWith(`${excluded}/`),
    );
  }
}
