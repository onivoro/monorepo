import { IEvent } from './event.interface';

export interface IEventWithQueryParams<TQueryStringParameters>
  extends IEvent<void, void, TQueryStringParameters> {
  queryStringParameters: TQueryStringParameters;
}
