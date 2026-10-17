import { Logger } from '@nestjs/common';
import {
  NotificationListener as NestFreeNotificationListener,
  NotificationListenerConnection,
  NotificationListenerOptions,
} from './notification-listener';

/**
 * The listener as the main entry point exports it: the same class as
 * `@onivoro/server-pg-notify/listener`'s, logging through Nest's `Logger`
 * (context `NotificationListener`) unless given a `logger`. Nest calls its
 * `onModuleInit` and `onModuleDestroy`.
 */
export abstract class NotificationListener<
  TNotification,
> extends NestFreeNotificationListener<TNotification> {
  constructor(
    channel: string,
    connection: NotificationListenerConnection,
    options: NotificationListenerOptions<TNotification> = {},
  ) {
    super(channel, connection, {
      ...options,
      logger:
        options.logger === undefined
          ? new Logger('NotificationListener')
          : options.logger,
    });
  }
}
