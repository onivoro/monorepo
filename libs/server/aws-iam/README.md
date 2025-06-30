# @onivoro/server-aws-iam

A NestJS module for integrating with AWS IAM (Identity and Access Management), providing user management, policy creation, group management, and access control capabilities for your server applications.

## Installation

```bash
npm install @onivoro/server-aws-iam
```

## Features

- **User Management**: Create, update, and manage IAM users
- **Group Management**: Create and manage IAM groups
- **Policy Management**: Create and attach IAM policies
- **Role Management**: Create and manage IAM roles
- **Access Key Management**: Generate and manage access keys
- **Permission Assignment**: Attach policies to users, groups, and roles
- **Policy Validation**: Validate policy documents
- **Credential Management**: Secure handling of IAM credentials

## Quick Start

### 1. Module Configuration

```typescript
import { ServerAwsIamModule } from '@onivoro/server-aws-iam';

@Module({
  imports: [
    ServerAwsIamModule.configure({
      AWS_REGION: 'us-east-1',
      AWS_PROFILE: process.env.AWS_PROFILE || 'default',
    }),
  ],
})
export class AppModule {}
```

### 2. Basic Usage

```typescript
import { IamService } from '@onivoro/server-aws-iam';

@Injectable()
export class UserManagementService {
  constructor(private iamService: IamService) {}

  async createUserGroup(groupName: string) {
    const group = await this.iamService.getGroup(groupName);
    return group;
  }

  async createCustomPolicy(policyName: string, policyDocument: any) {
    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: policyName,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: `Policy for ${policyName}`
    });

    return this.iamService.createPolicy(createPolicyCommand);
  }

  async attachPolicyToGroup(policyArn: string, groupName: string) {
    return this.iamService.attachPolicyToGroup({
      PolicyArn: policyArn,
      GroupName: groupName
    });
  }
}
```

## Configuration

### ServerAwsIamConfig

```typescript
import { ServerAwsIamConfig } from '@onivoro/server-aws-iam';

export class AppIamConfig extends ServerAwsIamConfig {
  AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  AWS_PROFILE = process.env.AWS_PROFILE || 'default';
  IAM_PATH_PREFIX = process.env.IAM_PATH_PREFIX || '/application/';
  DEFAULT_PASSWORD_POLICY = {
    MinimumPasswordLength: 12,
    RequireUppercaseCharacters: true,
    RequireLowercaseCharacters: true,
    RequireNumbers: true,
    RequireSymbols: true,
    AllowUsersToChangePassword: true,
    MaxPasswordAge: 90,
    PasswordReusePrevention: 5
  };
}
```

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# IAM Configuration
IAM_PATH_PREFIX=/application/
IAM_DEFAULT_SESSION_DURATION=3600
```

## Services

### IamService

The main service for IAM operations:

```typescript
import { IamService } from '@onivoro/server-aws-iam';

@Injectable()
export class IamManagementService {
  constructor(private iamService: IamService) {}

  async setupUserWithPermissions(userData: UserSetupData) {
    // Get or create group
    let group;
    try {
      group = await this.iamService.getGroup(userData.groupName);
    } catch (error) {
      console.log(`Group ${userData.groupName} not found, would need to create it`);
      // Group creation would require additional IAM client methods
    }

    // Create custom policy
    const policy = await this.iamService.createPolicy(new CreatePolicyCommand({
      PolicyName: `${userData.username}-policy`,
      PolicyDocument: JSON.stringify(userData.policyDocument),
      Description: `Custom policy for ${userData.username}`
    }));

    if (policy?.Policy?.Arn) {
      // Attach policy to group
      await this.iamService.attachPolicyToGroup({
        PolicyArn: policy.Policy.Arn,
        GroupName: userData.groupName
      });
    }

    return { group, policy };
  }
}
```

## Usage Examples

### User Management Service

```typescript
import { IamService } from '@onivoro/server-aws-iam';
import { 
  CreateUserCommand, 
  AttachUserPolicyCommand, 
  CreateAccessKeyCommand,
  DeleteUserCommand,
  DetachUserPolicyCommand,
  DeleteAccessKeyCommand
} from '@aws-sdk/client-iam';

@Injectable()
export class IamUserManagementService {
  constructor(private iamService: IamService) {}

  async createUser(username: string, path?: string) {
    const createUserCommand = new CreateUserCommand({
      UserName: username,
      Path: path || '/application/'
    });

    return this.iamService.iamClient.send(createUserCommand);
  }

  async createUserWithPolicy(username: string, policyArn: string) {
    // Create user
    const user = await this.createUser(username);
    
    // Attach policy
    const attachPolicyCommand = new AttachUserPolicyCommand({
      UserName: username,
      PolicyArn: policyArn
    });
    
    await this.iamService.iamClient.send(attachPolicyCommand);
    
    return user;
  }

  async createProgrammaticUser(username: string, policyArns: string[]) {
    // Create user
    const user = await this.createUser(username);
    
    // Attach policies
    for (const policyArn of policyArns) {
      await this.iamService.iamClient.send(new AttachUserPolicyCommand({
        UserName: username,
        PolicyArn: policyArn
      }));
    }
    
    // Create access key
    const accessKey = await this.iamService.iamClient.send(new CreateAccessKeyCommand({
      UserName: username
    }));
    
    return {
      user,
      accessKey: {
        accessKeyId: accessKey.AccessKey?.AccessKeyId,
        secretAccessKey: accessKey.AccessKey?.SecretAccessKey
      }
    };
  }

  async deleteUser(username: string) {
    try {
      // List and detach user policies
      const attachedPolicies = await this.iamService.iamClient.send(
        new ListAttachedUserPoliciesCommand({ UserName: username })
      );
      
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        await this.iamService.iamClient.send(new DetachUserPolicyCommand({
          UserName: username,
          PolicyArn: policy.PolicyArn
        }));
      }
      
      // List and delete access keys
      const accessKeys = await this.iamService.iamClient.send(
        new ListAccessKeysCommand({ UserName: username })
      );
      
      for (const accessKey of accessKeys.AccessKeyMetadata || []) {
        await this.iamService.iamClient.send(new DeleteAccessKeyCommand({
          UserName: username,
          AccessKeyId: accessKey.AccessKeyId
        }));
      }
      
      // Delete user
      return this.iamService.iamClient.send(new DeleteUserCommand({
        UserName: username
      }));
    } catch (error) {
      console.error(`Error deleting user ${username}:`, error);
      throw error;
    }
  }
}
```

### Policy Management Service

```typescript
import { IamService } from '@onivoro/server-aws-iam';
import { 
  CreatePolicyCommand, 
  DeletePolicyCommand, 
  CreatePolicyVersionCommand,
  GetPolicyCommand,
  ListPoliciesCommand
} from '@aws-sdk/client-iam';

@Injectable()
export class IamPolicyManagementService {
  constructor(private iamService: IamService) {}

  async createS3BucketPolicy(bucketName: string, permissions: string[] = ['GetObject', 'PutObject']) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: permissions.map(permission => `s3:${permission}`),
          Resource: [
            `arn:aws:s3:::${bucketName}/*`,
            `arn:aws:s3:::${bucketName}`
          ]
        }
      ]
    };

    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: `S3Access-${bucketName}`,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: `S3 access policy for bucket ${bucketName}`
    });

    return this.iamService.createPolicy(createPolicyCommand);
  }

  async createDynamoDBTablePolicy(tableName: string, actions: string[] = ['GetItem', 'PutItem', 'UpdateItem', 'DeleteItem']) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: actions.map(action => `dynamodb:${action}`),
          Resource: `arn:aws:dynamodb:*:*:table/${tableName}`
        }
      ]
    };

    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: `DynamoDBAccess-${tableName}`,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: `DynamoDB access policy for table ${tableName}`
    });

    return this.iamService.createPolicy(createPolicyCommand);
  }

  async createLambdaExecutionPolicy(functionName: string) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          Resource: `arn:aws:logs:*:*:log-group:/aws/lambda/${functionName}:*`
        },
        {
          Effect: 'Allow',
          Action: [
            'lambda:InvokeFunction'
          ],
          Resource: `arn:aws:lambda:*:*:function:${functionName}`
        }
      ]
    };

    const createPolicyCommand = new CreatePolicyCommand({
      PolicyName: `LambdaExecutionRole-${functionName}`,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: `Lambda execution policy for function ${functionName}`
    });

    return this.iamService.createPolicy(createPolicyCommand);
  }

  async updatePolicyDocument(policyArn: string, newPolicyDocument: any) {
    const createVersionCommand = new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: JSON.stringify(newPolicyDocument),
      SetAsDefault: true
    });

    return this.iamService.iamClient.send(createVersionCommand);
  }

  async validatePolicyDocument(policyDocument: any): Promise<boolean> {
    try {
      // Basic validation
      if (!policyDocument.Version || !policyDocument.Statement) {
        return false;
      }
      
      if (!Array.isArray(policyDocument.Statement)) {
        return false;
      }
      
      for (const statement of policyDocument.Statement) {
        if (!statement.Effect || !statement.Action) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async listCustomPolicies(pathPrefix?: string) {
    const listPoliciesCommand = new ListPoliciesCommand({
      Scope: 'Local', // Only customer-managed policies
      PathPrefix: pathPrefix || '/application/',
      MaxItems: 100
    });

    return this.iamService.iamClient.send(listPoliciesCommand);
  }
}
```

### Role Management Service

```typescript
import { IamService } from '@onivoro/server-aws-iam';
import { 
  CreateRoleCommand, 
  AttachRolePolicyCommand, 
  AssumeRolePolicyDocument,
  DeleteRoleCommand,
  DetachRolePolicyCommand
} from '@aws-sdk/client-iam';

@Injectable()
export class IamRoleManagementService {
  constructor(private iamService: IamService) {}

  async createServiceRole(roleName: string, serviceType: 'lambda' | 'ecs' | 'ec2' | 'apigateway') {
    const trustPolicy = this.getTrustPolicyForService(serviceType);
    
    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: `Service role for ${serviceType}`,
      Path: '/service-role/'
    });

    return this.iamService.iamClient.send(createRoleCommand);
  }

  async createCrossAccountRole(roleName: string, trustedAccountId: string, externalId?: string) {
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: `arn:aws:iam::${trustedAccountId}:root`
          },
          Action: 'sts:AssumeRole',
          ...(externalId && {
            Condition: {
              StringEquals: {
                'sts:ExternalId': externalId
              }
            }
          })
        }
      ]
    };

    const createRoleCommand = new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: `Cross-account role for account ${trustedAccountId}`,
      Path: '/cross-account/'
    });

    return this.iamService.iamClient.send(createRoleCommand);
  }

  async attachPolicyToRole(roleName: string, policyArn: string) {
    const attachPolicyCommand = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyArn
    });

    return this.iamService.iamClient.send(attachPolicyCommand);
  }

  async createRoleWithPolicies(roleName: string, serviceType: string, policyArns: string[]) {
    // Create role
    const role = await this.createServiceRole(roleName, serviceType as any);
    
    // Attach policies
    for (const policyArn of policyArns) {
      await this.attachPolicyToRole(roleName, policyArn);
    }
    
    return role;
  }

  private getTrustPolicyForService(serviceType: string) {
    const servicePrincipals = {
      lambda: 'lambda.amazonaws.com',
      ecs: 'ecs-tasks.amazonaws.com',
      ec2: 'ec2.amazonaws.com',
      apigateway: 'apigateway.amazonaws.com'
    };

    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: servicePrincipals[serviceType] || serviceType
          },
          Action: 'sts:AssumeRole'
        }
      ]
    };
  }

  async deleteRole(roleName: string) {
    try {
      // List and detach role policies
      const attachedPolicies = await this.iamService.iamClient.send(
        new ListAttachedRolePoliciesCommand({ RoleName: roleName })
      );
      
      for (const policy of attachedPolicies.AttachedPolicies || []) {
        await this.iamService.iamClient.send(new DetachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policy.PolicyArn
        }));
      }
      
      // Delete role
      return this.iamService.iamClient.send(new DeleteRoleCommand({
        RoleName: roleName
      }));
    } catch (error) {
      console.error(`Error deleting role ${roleName}:`, error);
      throw error;
    }
  }
}
```

### Group Management Service

```typescript
import { IamService } from '@onivoro/server-aws-iam';
import { 
  CreateGroupCommand, 
  AddUserToGroupCommand, 
  RemoveUserFromGroupCommand,
  GetGroupCommand,
  DeleteGroupCommand
} from '@aws-sdk/client-iam';

@Injectable()
export class IamGroupManagementService {
  constructor(private iamService: IamService) {}

  async createGroup(groupName: string, path?: string) {
    const createGroupCommand = new CreateGroupCommand({
      GroupName: groupName,
      Path: path || '/application/'
    });

    return this.iamService.iamClient.send(createGroupCommand);
  }

  async createGroupWithPolicies(groupName: string, policyArns: string[]) {
    // Create group
    const group = await this.createGroup(groupName);
    
    // Attach policies
    for (const policyArn of policyArns) {
      await this.iamService.attachPolicyToGroup({
        PolicyArn: policyArn,
        GroupName: groupName
      });
    }
    
    return group;
  }

  async addUserToGroup(username: string, groupName: string) {
    const addUserCommand = new AddUserToGroupCommand({
      UserName: username,
      GroupName: groupName
    });

    return this.iamService.iamClient.send(addUserCommand);
  }

  async removeUserFromGroup(username: string, groupName: string) {
    const removeUserCommand = new RemoveUserFromGroupCommand({
      UserName: username,
      GroupName: groupName
    });

    return this.iamService.iamClient.send(removeUserCommand);
  }

  async getGroupDetails(groupName: string) {
    return this.iamService.getGroup(groupName);
  }

  async setupDepartmentGroup(departmentName: string, permissions: DepartmentPermissions) {
    const groupName = `${departmentName}-group`;
    
    // Create group
    const group = await this.createGroup(groupName);
    
    // Create department-specific policy
    const policyDocument = this.buildDepartmentPolicy(departmentName, permissions);
    const policy = await this.iamService.createPolicy(new CreatePolicyCommand({
      PolicyName: `${departmentName}-policy`,
      PolicyDocument: JSON.stringify(policyDocument),
      Description: `Policy for ${departmentName} department`
    }));
    
    // Attach policy to group
    if (policy?.Policy?.Arn) {
      await this.iamService.attachPolicyToGroup({
        PolicyArn: policy.Policy.Arn,
        GroupName: groupName
      });
    }
    
    return { group, policy };
  }

  private buildDepartmentPolicy(department: string, permissions: DepartmentPermissions) {
    const statements = [];
    
    if (permissions.s3Buckets) {
      statements.push({
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject'],
        Resource: permissions.s3Buckets.map(bucket => `arn:aws:s3:::${bucket}/*`)
      });
    }
    
    if (permissions.dynamoTables) {
      statements.push({
        Effect: 'Allow',
        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        Resource: permissions.dynamoTables.map(table => `arn:aws:dynamodb:*:*:table/${table}`)
      });
    }
    
    if (permissions.customActions) {
      statements.push({
        Effect: 'Allow',
        Action: permissions.customActions,
        Resource: '*'
      });
    }
    
    return {
      Version: '2012-10-17',
      Statement: statements
    };
  }
}
```

## Advanced Usage

### IAM Resource Factory

```typescript
@Injectable()
export class IamResourceFactory {
  constructor(private iamService: IamService) {}

  async createCompleteUserSetup(userConfig: CompleteUserConfig) {
    try {
      // Create user
      const user = await this.createUser(userConfig.username);
      
      // Create custom policies
      const policies = await this.createPolicies(userConfig.policies);
      
      // Create or get group
      const group = await this.ensureGroup(userConfig.groupName, policies.map(p => p.Policy?.Arn!));
      
      // Add user to group
      await this.addUserToGroup(userConfig.username, userConfig.groupName);
      
      // Create access keys if needed
      let accessKeys;
      if (userConfig.programmaticAccess) {
        accessKeys = await this.createAccessKeys(userConfig.username);
      }
      
      return {
        user,
        group,
        policies,
        accessKeys
      };
    } catch (error) {
      console.error('Error creating complete user setup:', error);
      throw error;
    }
  }

  private async createUser(username: string) {
    return this.iamService.iamClient.send(new CreateUserCommand({
      UserName: username,
      Path: '/application/'
    }));
  }

  private async createPolicies(policyConfigs: PolicyConfig[]) {
    const policies = [];
    
    for (const config of policyConfigs) {
      const policy = await this.iamService.createPolicy(new CreatePolicyCommand({
        PolicyName: config.name,
        PolicyDocument: JSON.stringify(config.document),
        Description: config.description
      }));
      policies.push(policy);
    }
    
    return policies;
  }

  private async ensureGroup(groupName: string, policyArns: string[]) {
    try {
      return await this.iamService.getGroup(groupName);
    } catch (error) {
      // Group doesn't exist, create it
      const group = await this.iamService.iamClient.send(new CreateGroupCommand({
        GroupName: groupName,
        Path: '/application/'
      }));
      
      // Attach policies
      for (const policyArn of policyArns) {
        await this.iamService.attachPolicyToGroup({
          PolicyArn: policyArn,
          GroupName: groupName
        });
      }
      
      return group;
    }
  }

  private async addUserToGroup(username: string, groupName: string) {
    return this.iamService.iamClient.send(new AddUserToGroupCommand({
      UserName: username,
      GroupName: groupName
    }));
  }

  private async createAccessKeys(username: string) {
    return this.iamService.iamClient.send(new CreateAccessKeyCommand({
      UserName: username
    }));
  }
}
```

## Best Practices

### 1. Principle of Least Privilege

```typescript
// Always grant minimum necessary permissions
const createMinimalS3Policy = (bucketName: string, prefix: string) => ({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: ['s3:GetObject'],
      Resource: `arn:aws:s3:::${bucketName}/${prefix}/*`
    }
  ]
});
```

### 2. Policy Validation

```typescript
async validatePolicyBeforeCreation(policyDocument: any): Promise<void> {
  if (!this.iamService.validatePolicyDocument(policyDocument)) {
    throw new Error('Invalid policy document structure');
  }
  
  // Additional validation logic
  const policySize = JSON.stringify(policyDocument).length;
  if (policySize > 6144) { // AWS limit is 6,144 characters
    throw new Error('Policy document exceeds size limit');
  }
}
```

### 3. Resource Naming Convention

```typescript
const generateResourceName = (resourceType: string, environment: string, purpose: string) => {
  return `${environment}-${resourceType}-${purpose}`;
};

// Example: prod-user-data-processor, dev-role-lambda-executor
```

## Testing

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServerAwsIamModule, IamService } from '@onivoro/server-aws-iam';

describe('IamService', () => {
  let service: IamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServerAwsIamModule.configure({
        AWS_REGION: 'us-east-1',
        AWS_PROFILE: 'test'
      })],
    }).compile();

    service = module.get<IamService>(IamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have IAM client', () => {
    expect(service.iamClient).toBeDefined();
  });
});
```

## API Reference

### Exported Classes
- `ServerAwsIamConfig`: Configuration class for IAM settings
- `ServerAwsIamModule`: NestJS module for IAM integration

### Exported Services
- `IamService`: Main IAM service with user, group, and policy management capabilities

## License

This package is part of the Onivoro monorepo and follows the same licensing terms.