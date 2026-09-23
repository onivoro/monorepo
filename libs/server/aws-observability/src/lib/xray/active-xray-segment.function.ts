import * as AWSXRay from 'aws-xray-sdk-core';

/**
 * Returns the active X-Ray segment without triggering the context-missing
 * strategy, which logs (or throws) whenever getSegment() runs outside a trace.
 */
export function activeXraySegment():
  | AWSXRay.Segment
  | AWSXRay.Subsegment
  | undefined {
  if (!AWSXRay.isAutomaticMode() || !AWSXRay.getNamespace().get('segment'))
    return undefined;
  return AWSXRay.getSegment();
}
