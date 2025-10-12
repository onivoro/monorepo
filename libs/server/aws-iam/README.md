# @onivoro/server-aws-iam

AWS IAM integration for NestJS applications with basic IAM operations.

## Installation

```bash
npm install @onivoro/server-aws-iam
```

## Overview

This library provides a simple AWS IAM integration for NestJS applications, offering basic IAM operations for groups and policies.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerAwsIamModule } from '@onivoro/server-aws-iam';

@Module({
  imports: [
    ServerAwsIamModule.configure()
  ]
})
export class AppModule {}
```

## Configuration

The module uses environment-based configuration:

```typescript
export class ServerAwsIamConfig {
  AWS_REGION: string;
  AWS_PROFILE?: string;  // Optional AWS profile
}
```

## Service

### IamService

The main service provides three IAM operations:

```typescript
import { Injectable } from '@nestjs/common';
import { IamService } from '@onivoro/server-aws-iam';

@Injectable()
export class IAMManagementService {
  constructor(private readonly iamService: IamService) {}

  // Get IAM group details
  async getGroupInfo(groupName: string) {
    const group = await this.iamService.getGroup(groupName);
    return {
      group: group.Group,
      users: group.Users,
      isTruncated: group.IsTruncated
    };
  }

  // Create a new IAM policy
  async createAccessPolicy(policyName: string, policyDocument: any) {
    const policy = await this.iamService.createPolicy(
      policyName,
      policyDocument
    );
    return policy;
  }

  // Attach policy to a group
  async grantGroupAccess(groupName: string, policyArn: string) {
    await this.iamService.attachPolicyToGroup(groupName, policyArn);
  }
}
```

## Direct Client Access

The service exposes the underlying IAM client for advanced operations:

```typescript
import { 
  ListUsersCommand,
  CreateUserCommand,
  DeleteUserCommand,
  ListRolesCommand,
  CreateRoleCommand,
  ListPoliciesCommand
} from '@aws-sdk/client-iam';

@Injectable()
export class AdvancedIAMService {
  constructor(private readonly iamService: IamService) {}

  // List all users
  async listUsers() {
    const command = new ListUsersCommand({});
    return await this.iamService.iamClient.send(command);
  }

  // Create a new user
  async createUser(userName: string) {
    const command = new CreateUserCommand({
      UserName: userName
    });
    return await this.iamService.iamClient.send(command);
  }

  // List all roles
  async listRoles() {
    const command = new ListRolesCommand({});
    return await this.iamService.iamClient.send(command);
  }

  // Create a new role
  async createRole(roleName: string, assumeRolePolicyDocument: string) {
    const command = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: assumeRolePolicyDocument
    });
    return await this.iamService.iamClient.send(command);
  }
}
```

## Complete Example

```typescript
import { Module, Injectable } from '@nestjs/common';
import { ServerAwsIamModule, IamService } from '@onivoro/server-aws-iam';

@Module({
  imports: [ServerAwsIamModule.configure()],
  providers: [PolicyManagementService],
  exports: [PolicyManagementService]
})
export class PolicyModule {}

@Injectable()
export class PolicyManagementService {
  constructor(private readonly iamService: IamService) {}

  async setupS3AccessForGroup(groupName: string, bucketName: string) {
    // Define policy document
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        },
        {
          Effect: 'Allow',
          Action: 's3:ListBucket',
          Resource: `arn:aws:s3:::${bucketName}`
        }
      ]
    };

    try {
      // Create the policy
      const policyName = `${groupName}-${bucketName}-access`;
      const policy = await this.iamService.createPolicy(
        policyName,
        policyDocument
      );

      // Attach policy to group
      await this.iamService.attachPolicyToGroup(
        groupName,
        policy.Policy.Arn
      );

      // Verify attachment
      const groupInfo = await this.iamService.getGroup(groupName);

      return {
        policy: policy.Policy,
        group: groupInfo.Group,
        users: groupInfo.Users
      };
    } catch (error) {
      console.error('Failed to setup S3 access:', error);
      throw error;
    }
  }
}
```

## Available Methods

The IamService provides three methods:

1. **getGroup(groupName: string)** - Retrieves information about an IAM group including its users
2. **createPolicy(policyName: string, policyDocument: any)** - Creates a new IAM policy
3. **attachPolicyToGroup(groupName: string, policyArn: string)** - Attaches a policy to a group

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

## Error Handling

```typescript
try {
  await iamService.getGroup('non-existent-group');
} catch (error) {
  if (error.name === 'NoSuchEntityException') {
    console.error('Group does not exist');
  }
}
```

## Limitations

- This library only provides three basic IAM operations
- For more comprehensive IAM functionality, use the exposed `iamClient` directly
- No built-in support for user management, role management, or access key operations

## Security Best Practices

1. **Least Privilege**: Grant only the minimum permissions required
2. **Policy Validation**: Always validate policy documents before creation
3. **Audit Trail**: Monitor IAM operations through CloudTrail
4. **Regular Reviews**: Periodically review group memberships and policies

## License

MIT