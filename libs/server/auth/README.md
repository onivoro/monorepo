# @onivoro/server-auth

A comprehensive NestJS authentication library providing JWT authentication, TOTP (Time-based One-Time Password), password hashing, and role-based access control.

## Installation

```bash
npm install @onivoro/server-auth
```

## Features

- JWT token authentication with TOTP support
- Password hashing and comparison using bcrypt
- Role-based access control with guards and decorators
- Multi-factor authentication (MFA)
- Parameter decorators for extracting user context
- Abstract base classes for custom implementations

## Quick Start

### 1. Import the Module

```typescript
import { ServerAuthModule } from '@onivoro/server-auth';

@Module({
  imports: [ServerAuthModule],
  // ...
})
export class AppModule {}
```

### 2. Configure Authentication

```typescript
import { ServerAuthConfig } from '@onivoro/server-auth';

@Injectable()
export class MyAuthConfig extends ServerAuthConfig {
  jwtSecret = process.env.JWT_SECRET;
  jwtExpiresIn = '24h';
  saltRounds = 12;
}
```

### 3. Use Authentication Guards

```typescript
import { HasTokenGuard, UserId } from '@onivoro/server-auth';

@Controller('protected')
@UseGuards(HasTokenGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@UserId() userId: string) {
    return { userId };
  }
}
```

## Core Components

### Authentication Services

#### LoginService
Handles user authentication with email/password:

```typescript
import { LoginService } from '@onivoro/server-auth';

@Injectable()
export class AuthController {
  constructor(private loginService: LoginService) {}

  @Post('login')
  async login(@Body() credentials: LoginWithEmailAndPasswordDto) {
    return this.loginService.login(credentials);
  }
}
```

#### TotpService
Manages TOTP generation and verification:

```typescript
import { TotpService } from '@onivoro/server-auth';

@Injectable()
export class MfaService {
  constructor(private totpService: TotpService) {}

  async generateSecret(email: string) {
    return this.totpService.generateSecret(email);
  }

  async verifyToken(secret: string, token: string) {
    return this.totpService.verifyToken(secret, token);
  }
}
```

### Password Utilities

```typescript
import { hashPassword, comparePassword } from '@onivoro/server-auth';

// Hash a password
const hashedPassword = await hashPassword('myPassword');

// Compare password
const isValid = await comparePassword('myPassword', hashedPassword);
```

### Guards

#### Role-Based Guards
```typescript
import { HasCompanyAdminRoleGuard, HasSystemAdministratorRoleGuard } from '@onivoro/server-auth';

@Controller('admin')
@UseGuards(HasCompanyAdminRoleGuard)
export class AdminController {
  @Get('users')
  getUsers() {
    // Only company admins can access
  }
}
```

#### Token Guards
```typescript
import { HasTokenGuard, IsUserTokenGuard } from '@onivoro/server-auth';

@Controller('user')
@UseGuards(HasTokenGuard, IsUserTokenGuard)
export class UserController {
  // Requires valid user token
}
```

### Parameter Decorators

Extract user context from requests:

```typescript
import { UserId, CompanyId, BrokerId } from '@onivoro/server-auth';

@Controller('context')
export class ContextController {
  @Get('info')
  getUserInfo(
    @UserId() userId: string,
    @CompanyId() companyId: string,
    @BrokerId() brokerId: string
  ) {
    return { userId, companyId, brokerId };
  }
}
```

### DTOs

The library provides comprehensive DTOs for authentication:

```typescript
import { 
  LoginWithEmailAndPasswordDto,
  MfaLoginWithEmailAndPasswordDto,
  TotpGenerationDto,
  TotpVerificationDto,
  AuthTokensDto
} from '@onivoro/server-auth';
```

## Advanced Usage

### Custom Auth Guard

```typescript
import { AbstractAuthGuard } from '@onivoro/server-auth';

@Injectable()
export class CustomAuthGuard extends AbstractAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Custom authentication logic
    return super.canActivate(context);
  }
}
```

### Custom Password Reset Service

```typescript
import { AbstractPasswordResetService } from '@onivoro/server-auth';

@Injectable()
export class MyPasswordResetService extends AbstractPasswordResetService {
  async sendResetEmail(email: string, token: string) {
    // Custom email sending logic
  }
}
```

## Configuration Options

```typescript
export class ServerAuthConfig {
  jwtSecret: string;           // JWT signing secret
  jwtExpiresIn: string;        // Token expiration time
  saltRounds: number;          // bcrypt salt rounds
  totpWindow: number;          // TOTP time window
  totpStep: number;           // TOTP time step
}
```

## Guard Factories

Create dynamic guards based on roles:

```typescript
import { hasAnyOfRolesGuardFactory, hasRoleGuardFactory } from '@onivoro/server-auth';

const AdminOrModeratorGuard = hasAnyOfRolesGuardFactory(['admin', 'moderator']);
const SuperAdminGuard = hasRoleGuardFactory('super-admin');
```

## License

MIT License - Part of the Onivoro monorepo ecosystem.