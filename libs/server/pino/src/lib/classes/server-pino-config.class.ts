import { RouteInfo, Type } from "@nestjs/common/interfaces";
import { randomUUID } from "crypto";
import { Params } from "nestjs-pino";
import { IncomingMessage, ServerResponse } from "node:http";
import { DestinationStream } from "pino";
import { Options } from "pino-http";

export const apiIdHeader = 'x-api-id';
export const apiKeyHeader = 'x-api-key';

export class ServerPinoConfig implements Params {
  exclude?: (string | RouteInfo)[] | undefined;
  pinoHttp?: Options<IncomingMessage, ServerResponse<IncomingMessage>, never> | DestinationStream | [Options<IncomingMessage, ServerResponse<IncomingMessage>, never>, DestinationStream] | undefined;
  forRoutes?: (string | RouteInfo | Type<any>)[] | undefined;
  renameContext?: string | undefined;
  useExisting?: true | undefined;

  constructor(overrides?: Partial<Params> & { excludeUrls?: (string | RegExp)[] }) {
    const defaultValues = ServerPinoConfig.getDefaultParams(overrides?.excludeUrls);

    Object.entries({ ...defaultValues, ...(overrides || {}) }).forEach(([key, value]) => {
      (this as any)[key] = value;
    });
  }

  static getDefaultParams(excludeUrls: (string | RegExp)[] = ['/api/health']): Params {
    return {
      pinoHttp: {
        autoLogging: {
          ignore: !!excludeUrls.length
            ? (req) => excludeUrls.some(pattern =>
              typeof pattern === 'string'
                ? req.url === pattern
                : pattern instanceof RegExp
                  ? pattern.test((req as any).url)
                  : false
            )
            : (req) => false,
        },
        genReqId: () => randomUUID(),
        redact: [
          'req.headers["accept"]',
          'req.headers["accept-encoding"]',
          'req.headers["accept-language"]',
          'req.headers["authorization"]',
          `req.headers["${apiIdHeader}"]`,
          `req.headers["${apiKeyHeader}"]`,
          'req.headers["cache-control"]',
          'req.headers["connection"]',
          'req.headers["cookie"]',
          'req.headers["sec-ch-ua"]',
          'req.headers["sec-ch-ua-mobile"]',
          'req.headers["sec-ch-ua-platform"]',
          'req.headers["sec-fetch-dest"]',
          'req.headers["sec-fetch-mode"]',
          'req.headers["sec-fetch-site"]',
          'req.headers["sec-fetch-user"]',
          'req.headers["cookie"]',
          'res.headers["set-cookie"]',
          'req.headers["upgrade-insecure-requests"]',
          'req.headers["user-agent"]',
        ],
        useLevel: 'info',
        transport: undefined,
      }
    };
  }
}
