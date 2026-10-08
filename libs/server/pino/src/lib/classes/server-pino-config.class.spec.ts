import {
  apiIdHeader,
  apiKeyHeader,
  ServerPinoConfig,
} from './server-pino-config.class';

type TIgnore = (req: { url?: string }) => boolean;

const ignoreOf = (params: any): TIgnore => params.pinoHttp.autoLogging.ignore;

describe('ServerPinoConfig', () => {
  describe('getDefaultParams', () => {
    it('ignores /api/health by default', () => {
      const ignore = ignoreOf(ServerPinoConfig.getDefaultParams());

      expect(ignore({ url: '/api/health' })).toBe(true);
      expect(ignore({ url: '/api/users' })).toBe(false);
    });

    it('matches string patterns exactly', () => {
      const ignore = ignoreOf(ServerPinoConfig.getDefaultParams(['/ping']));

      expect(ignore({ url: '/ping' })).toBe(true);
      expect(ignore({ url: '/ping/deep' })).toBe(false);
    });

    it('matches RegExp patterns', () => {
      const ignore = ignoreOf(
        ServerPinoConfig.getDefaultParams([/^\/static\//, '/x']),
      );

      expect(ignore({ url: '/static/app.js' })).toBe(true);
      expect(ignore({ url: '/x' })).toBe(true);
      expect(ignore({ url: '/api/static/app.js' })).toBe(false);
    });

    it('ignores nothing when given an empty list', () => {
      const ignore = ignoreOf(ServerPinoConfig.getDefaultParams([]));

      expect(ignore({ url: '/api/health' })).toBe(false);
    });

    it('treats unsupported pattern types as non-matching', () => {
      const ignore = ignoreOf(ServerPinoConfig.getDefaultParams([42 as any]));

      expect(ignore({ url: '42' })).toBe(false);
    });

    it('generates a unique uuid per request', () => {
      const { genReqId } = (ServerPinoConfig.getDefaultParams() as any)
        .pinoHttp;
      const a = genReqId();
      const b = genReqId();

      expect(a).toMatch(/^[0-9a-f-]{36}$/);
      expect(a).not.toBe(b);
    });

    it('redacts credentials and api key headers', () => {
      const { redact, useLevel } = (ServerPinoConfig.getDefaultParams() as any)
        .pinoHttp;

      expect(redact).toEqual(
        expect.arrayContaining([
          'req.headers["authorization"]',
          'req.headers["cookie"]',
          'res.headers["set-cookie"]',
          `req.headers["${apiIdHeader}"]`,
          `req.headers["${apiKeyHeader}"]`,
        ]),
      );
      expect(useLevel).toBe('info');
    });
  });

  describe('constructor', () => {
    it('applies the defaults when given no overrides', () => {
      const config = new ServerPinoConfig();

      expect(ignoreOf(config)({ url: '/api/health' })).toBe(true);
      expect(config.exclude).toBeUndefined();
    });

    it('builds the ignore list from excludeUrls', () => {
      const config = new ServerPinoConfig({ excludeUrls: ['/metrics'] });

      expect(ignoreOf(config)({ url: '/metrics' })).toBe(true);
      expect(ignoreOf(config)({ url: '/api/health' })).toBe(false);
    });

    it('lets overrides replace the defaults', () => {
      const pinoHttp = { level: 'debug' };
      const config = new ServerPinoConfig({ pinoHttp, renameContext: 'ctx' });

      expect(config.pinoHttp).toBe(pinoHttp);
      expect(config.renameContext).toBe('ctx');
    });
  });
});
