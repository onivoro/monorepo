import { Injectable } from '@nestjs/common';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsConsumerService, SqsConsumerConfig, MessageHandler } from './sqs-consumer.service';

@Injectable()
export class SqsConsumerFactoryService {
  constructor(private sqsClient: SQSClient) {}

  createConsumer<T = any>(
    config: SqsConsumerConfig,
    messageHandler: MessageHandler<T>
  ): SqsConsumerService {
    return new SqsConsumerService(this.sqsClient, messageHandler, config);
  }
}