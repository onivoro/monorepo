# @onivoro/server-aws-lambda

AWS Lambda invocation for NestJS applications, plus TypeScript interfaces for common Lambda event shapes.

## Installation

```bash
npm install @onivoro/server-aws-lambda @aws-sdk/client-lambda @nestjs/common
```

`@aws-sdk/client-lambda` and `@nestjs/common` are peer dependencies.

## Module Setup

`ServerAwsLambdaModule.configure(config)` takes the configuration object directly; the module does not read environment variables itself.

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsLambdaModule } from '@onivoro/server-aws-lambda';

@Module({
  imports: [
    ServerAwsLambdaModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

The module is not global. It provides and exports `LambdaService`, `ServerAwsLambdaConfig`, a `LambdaClient` instance, and the `AwsCredentials` provider from `@onivoro/server-aws-credential-providers`.

## Configuration

```typescript
export class ServerAwsLambdaConfig {
  constructor(public AWS_REGION: string) {}
  AWS_PROFILE?: string; // optional named profile from ~/.aws
}
```

Pass either an object literal (as above) or `new ServerAwsLambdaConfig('us-east-1')`.

### AWS Credentials

Credentials are resolved by [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- If `AWS_PROFILE` is set, credentials are loaded from that profile in the shared credentials file. If that fails, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or their lowercase forms) from the environment are used.
- If `AWS_PROFILE` is not set, the client uses the AWS SDK's default credential provider chain.

## LambdaService

### `invoke<TEvent>(event: TEvent, lambdaName: string, invocationType: InvocationType = InvocationType.RequestResponse)`

Sends an `InvokeCommand` with `FunctionName: lambdaName`, `InvocationType: invocationType`, and `Payload: JSON.stringify(event, null, 2)`.

- The type parameter describes the **event** you send, not the response. The return type is `Promise<any>`.
- The response is expected to be API Gateway-shaped (`{ statusCode, body }` where `body` is a JSON string). `invoke` decodes the payload bytes as UTF-8, parses them, then parses and returns `body`.
- If parsing fails (no payload, no `body`, or non-JSON), it returns `null`. `Event` and `DryRun` invocations return no payload, so they resolve to `null`.
- Errors from the AWS call itself (for example `ResourceNotFoundException`) are thrown. A function error (`FunctionError` set on the response) is not thrown: its payload has no `body`, so `invoke` returns `null`. Use `LambdaClient` directly (below) when you need error details or a response that is not API Gateway-shaped.

```typescript
import { Injectable } from '@nestjs/common';
import { InvocationType } from '@aws-sdk/client-lambda';
import { LambdaService } from '@onivoro/server-aws-lambda';

interface ResizeImageEvent {
  bucket: string;
  key: string;
  width: number;
}

@Injectable()
export class ThumbnailService {
  constructor(private readonly lambdaService: LambdaService) {}

  async createThumbnail(bucket: string, key: string) {
    // Synchronous (RequestResponse) invocation; resolves with the parsed `body` when the function finishes.
    return this.lambdaService.invoke<ResizeImageEvent>({ bucket, key, width: 256 }, 'resize-image');
  }

  async createThumbnailInBackground(bucket: string, key: string) {
    // Asynchronous invocation; resolves (to null) once Lambda has queued the event.
    await this.lambdaService.invoke<ResizeImageEvent>({ bucket, key, width: 256 }, 'resize-image', InvocationType.Event);
  }
}
```

### Reading responses with `LambdaClient`

The module exports the `LambdaClient` provider, so it can be injected directly:

```typescript
import { Injectable } from '@nestjs/common';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

@Injectable()
export class UserLookupService {
  constructor(private readonly lambda: LambdaClient) {}

  async getUser(userId: string) {
    const { Payload, FunctionError } = await this.lambda.send(new InvokeCommand({ FunctionName: 'get-user', Payload: JSON.stringify({ userId }) }));

    const result = JSON.parse(Payload?.transformToString() || '{}');
    if (FunctionError) {
      throw new Error(result.errorMessage ?? FunctionError);
    }
    return result;
  }
}
```

## Event Interfaces

Type helpers for writing Lambda handlers.

| Export                                                   | Shape                                                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IEvent<TBody, TPathParameters, TQueryStringParameters>` | Optional `body`, `pathParameters`, `queryStringParameters`, `headers` (`Authorization` / `authorization`), `requestContext.authorizer.userRoles`, `methodArn`, `Records: any[]`, `userPoolId` |
| `IEventWithBody<TBody>`                                  | `IEvent` with a required `body: TBody`                                                                                                                                                        |
| `IEventWithPathParams<TPathParameters>`                  | `IEvent` with required `pathParameters`                                                                                                                                                       |
| `IEventWithQueryParams<TQueryStringParameters>`          | `IEvent` with required `queryStringParameters`                                                                                                                                                |
| `IPreTokenGenerationEvent`                               | Cognito pre-token-generation trigger: `userName`, `request`, `response.claimsOverrideDetails.claimsToAddOrOverride`                                                                           |
| `ICallback<TReturnValue>`                                | Node-style handler callback `(error: Error \| null, returnValue: TReturnValue) => void`                                                                                                       |

```typescript
import { ICallback, IEventWithPathParams, IPreTokenGenerationEvent } from '@onivoro/server-aws-lambda';

export const getOrder = async (event: IEventWithPathParams<{ orderId: string }>) => {
  const { orderId } = event.pathParameters;
  return { statusCode: 200, body: JSON.stringify({ orderId }) };
};

export const preTokenGeneration = (event: IPreTokenGenerationEvent, _context: unknown, callback: ICallback<IPreTokenGenerationEvent>) => {
  event.response.claimsOverrideDetails.claimsToAddOrOverride = { tenant: 'acme' };
  callback(null, event);
};
```

## Exports

- `ServerAwsLambdaModule` - dynamic module with `configure(config)`
- `ServerAwsLambdaConfig` - configuration class (also injectable)
- `LambdaService` - `invoke(event, lambdaName, invocationType?)`
- `IEvent`, `IEventWithBody`, `IEventWithPathParams`, `IEventWithQueryParams`, `IPreTokenGenerationEvent`, `ICallback` - event and callback interfaces

## License

MIT
