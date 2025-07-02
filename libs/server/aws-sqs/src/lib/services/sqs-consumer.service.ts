import { Injectable } from '@nestjs/common';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, DeleteMessageBatchCommand, Message } from '@aws-sdk/client-sqs';

export interface SqsConsumerConfig {
  queueUrl: string;
  maxMessages?: number;
  visibilityTimeout?: number;
  waitTimeSeconds?: number;
  errorDelayMs?: number;
  emptyQueueDelayMs?: number;
}

export interface MessageHandler<T = any> {
  handleMessage(messageBody: T, messageAttributes?: Record<string, any>): Promise<void>;
}

@Injectable()
export class SqsConsumerService {
  private isPolling = false;
  private pollingPromise: Promise<void> | null = null;

  // Default configuration values
  private readonly config: Required<SqsConsumerConfig>;

  constructor(
    private sqsClient: SQSClient,
    private messageHandler: MessageHandler,
    config: SqsConsumerConfig
  ) {
    // Merge with defaults
    this.config = {
      queueUrl: config.queueUrl,
      maxMessages: config.maxMessages ?? 10,
      visibilityTimeout: config.visibilityTimeout ?? 300,
      waitTimeSeconds: config.waitTimeSeconds ?? 20,
      errorDelayMs: config.errorDelayMs ?? 5000,
      emptyQueueDelayMs: config.emptyQueueDelayMs ?? 1000
    };
  }

  async startPolling() {
    if (this.isPolling) {
      console.log('Queue consumer is already polling');
      return;
    }

    this.isPolling = true;
    console.log(`Starting continuous SQS polling for ${this.getQueueName()}...`);

    // Start the continuous polling loop
    this.pollingPromise = this.continuousPolling();
  }

  async stopPolling() {
    console.log(`Stopping queue consumer for ${this.getQueueName()}...`);
    this.isPolling = false;

    // Wait for the current polling cycle to complete
    if (this.pollingPromise) {
      await this.pollingPromise;
      this.pollingPromise = null;
    }

    console.log(`Queue consumer stopped for ${this.getQueueName()}`);
  }

  private async continuousPolling() {
    while (this.isPolling) {
      try {
        const messageCount = await this.pollMessages();

        if (messageCount === this.config.maxMessages) {
          // Queue likely has more messages, poll immediately
          console.log(`Queue ${this.getQueueName()} may have more messages, polling again immediately...`);
          continue;
        } else if (messageCount === 0) {
          // Queue is empty, add small delay
          await this.delay(this.config.emptyQueueDelayMs);
        }
        // If we got some messages but less than MAX, continue immediately
        // The long polling will handle the wait
      } catch (error) {
        console.error(`Error in polling loop for ${this.getQueueName()}:`, error);
        // Add delay before retrying after error
        await this.delay(this.config.errorDelayMs);
      }
    }
  }

  private async pollMessages(): Promise<number> {
    try {
      const response = await this.sqsClient.send(new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: this.config.maxMessages,
        WaitTimeSeconds: this.config.waitTimeSeconds,
        VisibilityTimeout: this.config.visibilityTimeout,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All']
      }));

      const messages = response.Messages || [];

      if (messages.length > 0) {
        console.log(`Received ${messages.length} messages from ${this.getQueueName()}`);
        await this.processMessages(messages);
      }

      return messages.length;
    } catch (error) {
      console.error(`Error polling messages from ${this.getQueueName()}:`, error);
      throw error;
    }
  }

  private async processMessages(messages: Message[]) {
    const processedMessageIds: string[] = [];
    const failedMessages: { message: Message; error: any }[] = [];

    for (const message of messages) {
      try {
        await this.processMessage(message);
        processedMessageIds.push(message.MessageId!);
      } catch (error) {
        console.error(`Failed to process message ${message.MessageId} from ${this.getQueueName()}:`, error);
        failedMessages.push({ message, error });
      }
    }

    // Delete successfully processed messages
    if (processedMessageIds.length > 0) {
      await this.deleteProcessedMessages(messages.filter(m => processedMessageIds.includes(m.MessageId!)));
    }

    // Log failed messages (they will return to queue after visibility timeout)
    if (failedMessages.length > 0) {
      console.error(`Failed to process ${failedMessages.length} messages from ${this.getQueueName()}. They will be retried.`);
    }
  }

  private async processMessage(message: Message) {
    const body = message.Body;
    if (!body) {
      throw new Error('Message body is empty');
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      throw new Error(`Failed to parse message body: ${error}`);
    }

    // Extract message attributes
    const messageAttributes: Record<string, any> = {};
    if (message.MessageAttributes) {
      for (const [key, value] of Object.entries(message.MessageAttributes)) {
        messageAttributes[key] = value.StringValue;
      }
    }

    // Delegate to the message handler
    await this.messageHandler.handleMessage(parsedBody, messageAttributes);
  }

  private async deleteProcessedMessages(messages: Message[]) {
    if (messages.length === 0) return;

    try {
      if (messages.length === 1) {
        // Single message deletion
        await this.sqsClient.send(new DeleteMessageCommand({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: messages[0].ReceiptHandle!
        }));
      } else {
        // Batch deletion for multiple messages
        const entries = messages.map((message, index) => ({
          Id: index.toString(),
          ReceiptHandle: message.ReceiptHandle!
        }));

        await this.sqsClient.send(new DeleteMessageBatchCommand({
          QueueUrl: this.config.queueUrl,
          Entries: entries
        }));
      }

      console.log(`Successfully deleted ${messages.length} processed messages from ${this.getQueueName()}`);
    } catch (error) {
      console.error(`Error deleting messages from ${this.getQueueName()}:`, error);
      // Don't throw - messages will become visible again after timeout
    }
  }

  // Manual trigger for processing messages (useful for testing)
  async processQueueManually() {
    console.log(`Manually triggering queue processing for ${this.getQueueName()}...`);
    await this.pollMessages();
  }

  // Get queue statistics
  async getQueueStats() {
    return {
      queueUrl: this.config.queueUrl,
      queueName: this.getQueueName(),
      isPolling: this.isPolling,
      config: {
        maxMessages: this.config.maxMessages,
        visibilityTimeout: this.config.visibilityTimeout,
        waitTimeSeconds: this.config.waitTimeSeconds
      }
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getQueueName(): string {
    // Extract queue name from URL
    const parts = this.config.queueUrl.split('/');
    return parts[parts.length - 1] || 'unknown-queue';
  }
}