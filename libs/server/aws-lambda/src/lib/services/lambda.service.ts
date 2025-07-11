import { Injectable } from "@nestjs/common";
import { InvokeCommand, InvocationType, LambdaClient } from "@aws-sdk/client-lambda";

@Injectable()
export class LambdaService {
  constructor(private lambda: LambdaClient) { }

  async invoke<TEvent>(
    event: TEvent,
    lambdaName: string,
    invocationType = InvocationType.RequestResponse
  ) {

    const command = new InvokeCommand({
      FunctionName: lambdaName,
      InvocationType: invocationType,
      Payload: JSON.stringify(event, null, 2),
    });

    const response = await this.lambda.send(command);

    try {
      return JSON.parse(JSON.parse(response?.Payload?.toString() || '{}').body);
    } catch (e) {
      return null;
    }
  }
}