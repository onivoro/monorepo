import { IEvent } from './event.interface';

export interface IEventWithBody<TBody> extends IEvent<TBody, void, void> {
  body: TBody;
}
