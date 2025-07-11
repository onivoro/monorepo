import { IEvent } from './event.interface';

export interface IEventWithPathParams<TPathParameters>
  extends IEvent<void, TPathParameters, void> {
  pathParameters: TPathParameters;
}
