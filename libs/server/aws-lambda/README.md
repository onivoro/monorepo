# @onivoro/server-aws-lambda

Type-safe AWS Lambda invocation for NestJS applications.

## Installation

```bash
npm install @onivoro/server-aws-lambda
```

## Overview

This library provides a simple AWS Lambda integration for NestJS applications, offering type-safe Lambda function invocation with automatic response parsing.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsLambdaModule } from '@onivoro/server-aws-lambda';

@Module({
  imports: [
    ServerAwsLambdaModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsLambdaConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### LambdaService

The main service for invoking Lambda functions:

```typescript
import { Injectable } from '@nestjs/common';
import { LambdaService } from '@onivoro/server-aws-lambda';

@Injectable()
export class FunctionInvokerService {
  constructor(private readonly lambdaService: LambdaService) {}

  async invokeDataProcessor(data: any) {
    const result = await this.lambdaService.invoke<ProcessorResponse>({
      functionName: 'data-processor-function',
      body: {
        action: 'process',
        data: data
      }
    });
    
    return result;
  }

  async invokeWithoutPayload(functionName: string) {
    return await this.lambdaService.invoke({
      functionName
    });
  }
}
```

## Method Details

### invoke<T>(params)

The `invoke` method accepts an object with the following properties:

- **functionName** (string, required): The name or ARN of the Lambda function
- **body** (any, optional): The payload to send to the function (will be JSON stringified)

The method returns the parsed response of type `T` (if specified).

## Response Parsing

The service automatically handles response parsing with the following logic:

1. If the Lambda returns a response with `statusCode` and `body` (API Gateway format), it parses the nested body
2. Otherwise, it returns the Lambda response payload directly
3. All responses are automatically JSON parsed

## Type Safety

Use TypeScript generics for type-safe responses:

```typescript
interface UserData {
  id: string;
  name: string;
  email: string;
}

const userData = await lambdaService.invoke<UserData>({
  functionName: 'get-user-function',
  body: { userId: '123' }
});

// userData is typed as UserData
console.log(userData.email);
```

## Direct Client Access

The service exposes the underlying Lambda client for advanced operations:

```typescript
import { 
  ListFunctionsCommand,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
  CreateFunctionCommand
} from '@aws-sdk/client-lambda';

@Injectable()
export class AdvancedLambdaService {
  constructor(private readonly lambdaService: LambdaService) {}

  // List all Lambda functions
  async listFunctions() {
    const command = new ListFunctionsCommand({});
    return await this.lambdaService.lambdaClient.send(command);
  }

  // Get function configuration
  async getFunctionInfo(functionName: string) {
    const command = new GetFunctionCommand({
      FunctionName: functionName
    });
    return await this.lambdaService.lambdaClient.send(command);
  }

  // Invoke with specific invocation type
  async invokeAsync(functionName: string, payload: any) {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async invocation
      Payload: Buffer.from(JSON.stringify(payload))
    });
    return await this.lambdaService.lambdaClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsLambdaModule, LambdaService } from '@onivoro/server-aws-lambda';

// Types for Lambda responses
interface CalculationResult {
  result: number;
  operation: string;
  timestamp: string;
}

interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

@Module({
  imports: [ServerAwsLambdaModule.configure()],
  providers: [MicroserviceGateway],
  exports: [MicroserviceGateway]
})
export class GatewayModule {}

@Injectable()
export class MicroserviceGateway {
  constructor(private readonly lambdaService: LambdaService) {}

  // Invoke calculation microservice
  async calculate(operation: string, values: number[]) {
    try {
      const result = await this.lambdaService.invoke<CalculationResult>({
        functionName: 'calculator-service',
        body: {
          operation,
          values
        }
      });

      console.log(`Calculation completed: ${result.operation} = ${result.result}`);
      return result;
    } catch (error) {
      console.error('Calculation failed:', error);
      throw error;
    }
  }

  // Invoke validation microservice
  async validateData(data: any, rules: any) {
    const result = await this.lambdaService.invoke<ValidationResult>({
      functionName: 'validator-service',
      body: {
        data,
        rules
      }
    });

    if (!result.isValid) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }

    return result;
  }

  // Chain multiple Lambda functions
  async processOrder(order: any) {
    // Step 1: Validate order
    await this.validateData(order, {
      required: ['customerId', 'items', 'paymentMethod']
    });

    // Step 2: Calculate totals
    const calculation = await this.calculate('sum', 
      order.items.map(item => item.price * item.quantity)
    );

    // Step 3: Process payment
    const payment = await this.lambdaService.invoke<{transactionId: string}>({
      functionName: 'payment-processor',
      body: {
        amount: calculation.result,
        paymentMethod: order.paymentMethod,
        customerId: order.customerId
      }
    });

    return {
      orderId: order.id,
      total: calculation.result,
      transactionId: payment.transactionId
    };
  }
}
```

## Error Handling

```typescript
try {
  const result = await lambdaService.invoke({
    functionName: 'my-function',
    body: { data: 'test' }
  });
} catch (error) {
  if (error.name === 'ResourceNotFoundException') {
    console.error('Lambda function not found');
  } else if (error.name === 'TooManyRequestsException') {
    console.error('Rate limit exceeded');
  } else if (error.FunctionError) {
    console.error('Lambda function error:', error.Payload);
  }
}
```

## Environment Variables

```bash
# Required: AWS region
AWS_REGION=us-east-1

# Optional: AWS profile
AWS_PROFILE=my-profile
```

## AWS Credentials

The module uses the standard AWS SDK credential chain:
1. Environment variables
2. Shared credentials file
3. IAM roles (for EC2/ECS/Lambda)

## Limitations

- Only supports synchronous invocation (RequestResponse)
- No built-in retry logic
- Assumes JSON payloads and responses
- For advanced invocation options, use the exposed `lambdaClient` directly

## Best Practices

1. **Function Naming**: Use consistent naming conventions for Lambda functions
2. **Error Handling**: Always handle potential Lambda errors and timeouts
3. **Payload Size**: Keep payloads under 6 MB (synchronous invocation limit)
4. **Timeouts**: Set appropriate timeouts for your Lambda functions
5. **Monitoring**: Use CloudWatch Logs and X-Ray for debugging

## License

MIT