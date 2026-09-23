import * as xrayExpress from 'aws-xray-sdk-express';
import { XrayMiddleware } from './xray.middleware';

jest.mock('aws-xray-sdk-express', () => ({
  openSegment: jest.fn(),
}));

describe('XrayMiddleware', () => {
  const openSegment = xrayExpress.openSegment as jest.Mock;
  const requestHandler = jest.fn((_req, _res, next) => next());

  beforeEach(() => {
    jest.clearAllMocks();
    openSegment.mockReturnValue(requestHandler);
  });

  it('skips excluded paths', () => {
    const next = jest.fn();
    const middleware = new XrayMiddleware({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
      xray: { excludePaths: ['/api/health'] },
    });

    middleware.use({ path: '/api/health/ready' } as never, {} as never, next);

    expect(requestHandler).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('opens a segment for included paths', () => {
    const next = jest.fn();
    const middleware = new XrayMiddleware({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
    });

    middleware.use({ path: '/api/work' } as never, {} as never, next);

    expect(openSegment).toHaveBeenCalledWith('api');
    expect(requestHandler).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prefers the configured segment name and builds the handler once', () => {
    const middleware = new XrayMiddleware({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
      xray: { segmentName: 'api-segment' },
    });

    middleware.use({ path: '/a' } as never, {} as never, jest.fn());
    middleware.use({ path: '/b' } as never, {} as never, jest.fn());

    expect(openSegment).toHaveBeenCalledTimes(1);
    expect(openSegment).toHaveBeenCalledWith('api-segment');
  });
});
