import * as AWSXRay from 'aws-xray-sdk-core';
import { pinoXrayMixin, xrayLogFields } from './xray-log-fields.function';

const namespaceGet = jest.fn();

jest.mock('aws-xray-sdk-core', () => ({
  getSegment: jest.fn(),
  isAutomaticMode: jest.fn(() => true),
  getNamespace: jest.fn(() => ({ get: namespaceGet })),
}));

describe('xrayLogFields', () => {
  const getSegment = AWSXRay.getSegment as jest.Mock;

  function activate(segment: unknown): void {
    namespaceGet.mockReturnValue(segment);
    getSegment.mockReturnValue(segment);
  }

  afterEach(() => {
    getSegment.mockReset();
    namespaceGet.mockReset();
  });

  it('returns empty fields without calling getSegment when no segment is active', () => {
    namespaceGet.mockReturnValue(undefined);

    expect(xrayLogFields()).toEqual({});
    expect(getSegment).not.toHaveBeenCalled();
  });

  it('returns trace and segment ids for active root segments', () => {
    activate({ trace_id: '1-abc', id: 'seg-1' });

    expect(xrayLogFields()).toEqual({
      xray_trace_id: '1-abc',
      xray_segment_id: 'seg-1',
    });
  });

  it('provides a pino-compatible mixin', () => {
    activate({ trace_id: '1-abc', id: 'seg-1' });

    expect(pinoXrayMixin()()).toEqual({
      xray_trace_id: '1-abc',
      xray_segment_id: 'seg-1',
    });
  });
});
