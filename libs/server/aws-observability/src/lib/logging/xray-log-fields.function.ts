import { activeXraySegment } from '../xray/active-xray-segment.function';

export function xrayLogFields(): Record<string, string> {
  const segment = activeXraySegment();
  if (!segment) return {};
  const traceId =
    'trace_id' in segment && typeof segment.trace_id === 'string'
      ? segment.trace_id
      : undefined;

  return {
    ...(traceId ? { xray_trace_id: traceId } : {}),
    xray_segment_id: segment.id,
  };
}

export function pinoXrayMixin(): () => Record<string, string> {
  return () => xrayLogFields();
}
