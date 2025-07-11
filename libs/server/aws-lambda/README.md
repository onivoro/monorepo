# @onivoro/server-aws-lambda

A NestJS module that provides type-safe AWS Lambda invocation capabilities for server-side applications.

## Installation

```bash
npm install @onivoro/server-aws-lambda
```

## Features

- Type-safe Lambda function invocation with full TypeScript support
- Support for multiple Lambda event types (API Gateway, Cognito, S3, SQS)
- Synchronous and asynchronous invocation patterns
- Automatic response parsing and error handling
- Clean NestJS module integration
- AWS SDK v3 compatibility

## Quick Start

Import and configure the module in your NestJS application:

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsLambdaModule, ServerAwsLambdaConfig } from '@onivoro/server-aws-lambda';

@Module({
  imports: [
    ServerAwsLambdaModule.configure(
      ServerAwsLambdaModule,
      new ServerAwsLambdaConfig('us-east-1')
    ),
  ],
})
export class AppModule {}
```

Basic usage example:

```typescript
import { Injectable } from '@nestjs/common';
import { LambdaService } from '@onivoro/server-aws-lambda';

@Injectable()
export class UserService {
  constructor(private readonly lambdaService: LambdaService) {}

  async processUser(userId: string) {
    const event = {
      body: JSON.stringify({ userId }),
      headers: { 'Content-Type': 'application/json' },
    };

    const result = await this.lambdaService.invoke(
      event,
      'user-processor-lambda'
    );

    return result;
  }
}
```

## Configuration

The module requires minimal configuration:

```typescript
export class ServerAwsLambdaConfig {
  constructor(public AWS_REGION: string) {}
}
```

### Environment Variables

Configure your AWS region through environment variables:

```bash
AWS_REGION=us-east-1
```

### Advanced Configuration

For custom Lambda client configuration:

```typescript
import { LambdaClient } from '@aws-sdk/client-lambda';

// The module automatically creates a Lambda client with your region
// AWS credentials are loaded from the standard AWS credential chain
```

## Usage Examples

### API Gateway Event with Body

```typescript
import { IEventWithBody } from '@onivoro/server-aws-lambda';

interface CreateOrderDto {
  productId: string;
  quantity: number;
}

async createOrder(orderData: CreateOrderDto) {
  const event: IEventWithBody<CreateOrderDto> = {
    body: JSON.stringify(orderData),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
    },
  };

  // Invoke order processing Lambda
  const response = await this.lambdaService.invoke(
    event,
    'order-processor-lambda'
  );

  return response;
}
```

### API Gateway Event with Path Parameters

```typescript
import { IEventWithPathParams } from '@onivoro/server-aws-lambda';

interface UserPathParams {
  userId: string;
}

async getUser(userId: string) {
  const event: IEventWithPathParams<UserPathParams> = {
    pathParameters: { userId },
    headers: { 'Accept': 'application/json' },
  };

  const user = await this.lambdaService.invoke(
    event,
    'get-user-lambda'
  );

  return user;
}
```

### API Gateway Event with Query Parameters

```typescript
import { IEventWithQueryParams } from '@onivoro/server-aws-lambda';

interface SearchParams {
  q: string;
  limit: string;
  offset: string;
}

async searchProducts(query: string, limit = 10, offset = 0) {
  const event: IEventWithQueryParams<SearchParams> = {
    queryStringParameters: {
      q: query,
      limit: limit.toString(),
      offset: offset.toString(),
    },
  };

  const results = await this.lambdaService.invoke(
    event,
    'product-search-lambda'
  );

  return results;
}
```

### Cognito Pre-Token Generation Event

```typescript
import { IPreTokenGenerationEvent } from '@onivoro/server-aws-lambda';

async customizeTokens(userId: string, groups: string[]) {
  const event: IPreTokenGenerationEvent = {
    userPoolId: 'us-east-1_ABC123',
    request: {
      userAttributes: {
        sub: userId,
        email: 'user@example.com',
      },
      groupConfiguration: {
        groupsToOverride: groups,
      },
    },
  };

  const response = await this.lambdaService.invoke(
    event,
    'token-customizer-lambda'
  );

  return response;
}
```

### Asynchronous Invocation

```typescript
import { InvocationType } from '@aws-sdk/client-lambda';

async triggerBackgroundJob(jobData: any) {
  const event = {
    body: JSON.stringify(jobData),
    headers: { 'X-Job-Type': 'data-processing' },
  };

  // Fire-and-forget invocation
  await this.lambdaService.invoke(
    event,
    'background-job-lambda',
    InvocationType.Event // Asynchronous invocation
  );

  // Returns immediately without waiting for Lambda response
  return { jobId: jobData.id, status: 'queued' };
}
```

### Generic Event with Multiple Parameters

```typescript
import { IEvent } from '@onivoro/server-aws-lambda';

interface OrderBody {
  items: Array<{ sku: string; quantity: number }>;
}

interface OrderPathParams {
  customerId: string;
}

interface OrderQueryParams {
  couponCode?: string;
}

async processComplexOrder(
  customerId: string,
  items: OrderBody['items'],
  couponCode?: string
) {
  const event: IEvent<OrderBody, OrderPathParams, OrderQueryParams> = {
    body: JSON.stringify({ items }),
    pathParameters: { customerId },
    queryStringParameters: couponCode ? { couponCode } : {},
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    },
    requestContext: {
      authorizer: {
        claims: {
          sub: customerId,
          'custom:role': 'premium-customer',
        },
      },
    },
  };

  const order = await this.lambdaService.invoke(
    event,
    'complex-order-processor'
  );

  return order;
}
```

### Error Handling

```typescript
async safeInvoke(event: any, functionName: string) {
  try {
    const result = await this.lambdaService.invoke(event, functionName);
    
    // Note: invoke returns null if response parsing fails
    if (result === null) {
      throw new Error('Failed to parse Lambda response');
    }
    
    return result;
  } catch (error) {
    // Handle AWS SDK errors (network, permissions, etc.)
    console.error('Lambda invocation failed:', error);
    throw new InternalServerErrorException('Service temporarily unavailable');
  }
}
```

## API Reference

### LambdaService

The main service for invoking Lambda functions.

#### Methods

##### `invoke<TEvent>(event: TEvent, lambdaName: string, invocationType?: InvocationType): Promise<any>`

Invokes a Lambda function with the specified event.

- `event`: The event payload to send to the Lambda function
- `lambdaName`: The name or ARN of the Lambda function to invoke
- `invocationType`: Optional invocation type (default: `RequestResponse`)
  - `RequestResponse`: Synchronous invocation
  - `Event`: Asynchronous invocation
  - `DryRun`: Validate parameters and permissions without invoking

Returns the parsed response body or `null` if parsing fails.

### Event Interfaces

#### `IEvent<TBody, TPathParameters, TQueryStringParameters>`

Base event interface supporting multiple parameter types.

```typescript
interface IEvent<TBody = any, TPathParameters = any, TQueryStringParameters = any> {
  body?: string;
  headers?: { [key: string]: string };
  pathParameters?: TPathParameters;
  queryStringParameters?: TQueryStringParameters;
  requestContext?: {
    authorizer?: {
      claims?: { [key: string]: string };
    };
  };
  Records?: any[];
  userPoolId?: string;
  request?: any;
}
```

#### Specialized Event Types

- `IEventWithBody<TBody>`: Events with JSON body payload
- `IEventWithPathParams<TPathParameters>`: Events with path parameters
- `IEventWithQueryParams<TQueryStringParameters>`: Events with query string parameters
- `IPreTokenGenerationEvent`: Cognito pre-token generation trigger events

### Configuration Classes

#### `ServerAwsLambdaConfig`

Configuration class for the Lambda module.

```typescript
export class ServerAwsLambdaConfig {
  constructor(public AWS_REGION: string) {}
}
```

## Best Practices

1. **Type Your Events**: Always use the provided TypeScript interfaces for type safety
2. **Handle Null Responses**: The `invoke` method returns `null` on parsing errors - always check for this
3. **Use Appropriate Invocation Types**: Use `Event` type for fire-and-forget operations to avoid timeouts
4. **Structure Lambda Responses**: Ensure your Lambda functions return API Gateway-style responses with a `body` property
5. **Implement Retry Logic**: Add retry mechanisms for transient failures
6. **Monitor Invocation Metrics**: Track Lambda invocation success rates and latencies
7. **Set Appropriate Timeouts**: Configure Lambda timeouts based on expected execution time
8. **Use Environment-Specific Function Names**: Parameterize Lambda function names for different environments

## Testing

Example test setup:

```typescript
import { Test } from '@nestjs/testing';
import { LambdaService } from '@onivoro/server-aws-lambda';

describe('UserService', () => {
  let userService: UserService;
  let lambdaService: jest.Mocked<LambdaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: LambdaService,
          useValue: {
            invoke: jest.fn(),
          },
        },
      ],
    }).compile();

    userService = module.get(UserService);
    lambdaService = module.get(LambdaService);
  });

  it('should invoke user processor lambda', async () => {
    const mockResponse = { userId: '123', status: 'processed' };
    lambdaService.invoke.mockResolvedValue(mockResponse);

    const result = await userService.processUser('123');

    expect(lambdaService.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({ userId: '123' }),
      }),
      'user-processor-lambda'
    );
    expect(result).toEqual(mockResponse);
  });
});
```

## License

This library is part of the @onivoro monorepo.