# @onivoro/server-aws-iam

AWS IAM integration for NestJS applications with basic group and policy operations.

## Installation

```bash
npm install @onivoro/server-aws-iam @aws-sdk/client-iam @nestjs/common
```

`@aws-sdk/client-iam` and `@nestjs/common` are peer dependencies.

## Module Setup

`ServerAwsIamModule.configure(config)` takes the configuration object directly; the module does not read environment variables itself.

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsIamModule } from '@onivoro/server-aws-iam';

@Module({
  imports: [
    ServerAwsIamModule.configure({
      AWS_REGION: process.env.AWS_REGION!,
      AWS_PROFILE: process.env.AWS_PROFILE, // optional
    }),
  ],
})
export class AppModule {}
```

The module is not global. It provides and exports `IamService`, `ServerAwsIamConfig`, an `IAMClient` instance, and the `AwsCredentials` provider from `@onivoro/server-aws-credential-providers`.

## Configuration

```typescript
export class ServerAwsIamConfig {
  AWS_PROFILE?: string; // optional named profile from ~/.aws
  AWS_REGION: string;
}
```

### AWS Credentials

Credentials are resolved by [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/):

- If `AWS_PROFILE` is set, credentials are loaded from that profile in the shared credentials file. If that fails, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or their lowercase forms) from the environment are used.
- If `AWS_PROFILE` is not set, the client uses the AWS SDK's default credential provider chain.

## IamService

| Method                                                   | Returns                                                                                           | Errors                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `getGroup(GroupName: string)`                            | `GetGroupCommandOutput` (group plus the first page of its users)                                  | SDK errors are thrown                        |
| `createPolicy(createPolicyCommand: CreatePolicyCommand)` | `CreatePolicyCommandOutput`, or `undefined` (with a logged error) if the response has no `Policy` | SDK errors are thrown                        |
| `attachPolicyToGroup({ PolicyArn, GroupName })`          | `AttachGroupPolicyCommandOutput`, or `undefined` on failure                                       | SDK errors are caught and logged, not thrown |

The underlying client is public as `iamService.iamClient`.

```typescript
import { Injectable } from '@nestjs/common';
import { CreatePolicyCommand } from '@aws-sdk/client-iam';
import { IamService } from '@onivoro/server-aws-iam';

@Injectable()
export class BucketAccessService {
  constructor(private readonly iamService: IamService) {}

  async grantBucketAccess(groupName: string, bucketName: string) {
    const created = await this.iamService.createPolicy(
      new CreatePolicyCommand({
        PolicyName: `${groupName}-${bucketName}-access`,
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: ['s3:GetObject', 's3:PutObject'],
              Resource: `arn:aws:s3:::${bucketName}/*`,
            },
          ],
        }),
      }),
    );

    const policyArn = created?.Policy?.Arn;
    if (!policyArn) {
      throw new Error('Policy was not created');
    }

    await this.iamService.attachPolicyToGroup({ PolicyArn: policyArn, GroupName: groupName });

    const { Group, Users } = await this.iamService.getGroup(groupName);
    return { policyArn, group: Group, users: Users };
  }
}
```

Because `attachPolicyToGroup` swallows errors, check for an `undefined` result if you need to know whether the attachment succeeded.

## Direct Client Access

```typescript
import { Injectable } from '@nestjs/common';
import { ListRolesCommand } from '@aws-sdk/client-iam';
import { IamService } from '@onivoro/server-aws-iam';

@Injectable()
export class RoleLookupService {
  constructor(private readonly iamService: IamService) {}

  listRoles() {
    return this.iamService.iamClient.send(new ListRolesCommand({}));
  }
}
```

You can also inject `IAMClient` directly, since the module exports it.

## Exports

- `ServerAwsIamModule` - dynamic module with `configure(config)`
- `ServerAwsIamConfig` - configuration class (also injectable)
- `IamService` - `getGroup`, `createPolicy`, `attachPolicyToGroup`, and the public `iamClient`

## License

MIT
