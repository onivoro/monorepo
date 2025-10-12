# @onivoro/server-common

Common server utilities, DTOs, decorators, and foundational components for NestJS applications.

## Installation

```bash
npm install @onivoro/server-common
```

## Overview

This library provides a comprehensive set of utilities, decorators, DTOs, pipes, and functions commonly used in NestJS server applications. It includes error handling, API decorators, validation pipes, and various utility functions.

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerCommonModule } from '@onivoro/server-common';

@Module({
  imports: [ServerCommonModule]
})
export class AppModule {}
```

## Error Filters

### ErrorFilter

Base error filter for handling exceptions:

```typescript
import { ErrorFilter } from '@onivoro/server-common';

// Use globally
app.useGlobalFilters(new ErrorFilter());

// Or in a controller
@UseFilters(ErrorFilter)
@Controller('users')
export class UsersController {}
```

### TypeormErrorFilter

Specialized filter for TypeORM database errors:

```typescript
import { TypeormErrorFilter } from '@onivoro/server-common';

app.useGlobalFilters(new TypeormErrorFilter());
```

## Decorators

### API Documentation Decorators

```typescript
import {
  ApiBodyUnspecified,
  ApiQueryPagedParams,
  ApiResponsePaged,
  ApiResponseUnspecified,
  ApiResponseUnspecifiedArray,
  DefaultApiController
} from '@onivoro/server-common';

@DefaultApiController('users')  // Combines @Controller and @ApiTags
export class UsersController {
  
  @Get()
  @ApiResponsePaged(UserDto)  // Documents paginated response
  @ApiQueryPagedParams()      // Documents pagination query params
  findAll(@QueryPagedParams() params: any) {
    // Implementation
  }

  @Post()
  @ApiBodyUnspecified()         // For dynamic body types
  @ApiResponseUnspecified()     // For dynamic response types
  create(@Body() data: any) {
    // Implementation
  }

  @Get('list')
  @ApiResponseUnspecifiedArray() // For dynamic array responses
  getList() {
    // Implementation
  }
}
```

### Environment Configuration Decorator

```typescript
import { EnvironmentClass } from '@onivoro/server-common';

@EnvironmentClass()
export class AppConfig {
  API_URL: string;
  DATABASE_URL: string;
  PORT?: number = 3000;  // With default
}
```

### Query Parameter Decorators

```typescript
import { QueryPagedParams } from '@onivoro/server-common';

@Get()
findAll(@QueryPagedParams() params: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}) {
  // Implementation
}
```

## DTOs (Data Transfer Objects)

### Common DTOs

```typescript
import {
  AccountUserDto,
  BodyDto,
  EmailDto,
  HealthDto,
  PagedResponseDto,
  PutPasswordDto,
  SuccessDto,
  StringArrayDto,
  UrlDto,
  UserIdDto,
  ValueDto,
  ValuesDto,
  LookupDto
} from '@onivoro/server-common';

// Account user information
const user: AccountUserDto = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

// Paginated response
const response: PagedResponseDto<UserDto> = {
  data: users,
  total: 100,
  page: 1,
  pageSize: 10
};

// Simple value wrapper
const value: ValueDto<string> = {
  value: 'some-value'
};

// Multiple values
const values: ValuesDto<number> = {
  values: [1, 2, 3, 4, 5]
};

// Lookup/dropdown option
const option: LookupDto<string, number> = {
  display: 'Option One',
  value: 1
};
```

## Validation Pipes

### Date and Time Pipes

```typescript
import {
  ParseDateOptionalPipe,
  ParseMonthPipe,
  ParseYearPipe
} from '@onivoro/server-common';

@Get('by-date')
findByDate(
  @Query('date', ParseDateOptionalPipe) date?: Date,
  @Query('month', ParseMonthPipe) month?: number,
  @Query('year', ParseYearPipe) year?: number
) {
  // Implementation
}
```

### UUID Pipes

```typescript
import {
  ParseUuidOptionalPipe,
  ParseUuidsPipe
} from '@onivoro/server-common';

@Get(':id')
findOne(@Param('id', ParseUuidOptionalPipe) id?: string) {
  // Implementation
}

@Post('batch')
findMany(@Body('ids', ParseUuidsPipe) ids: string[]) {
  // Implementation
}
```

### Zod Validation Pipe

```typescript
import { ZodValidationPipe } from '@onivoro/server-common';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().positive()
});

@Post()
create(@Body(new ZodValidationPipe(UserSchema)) user: z.infer<typeof UserSchema>) {
  // Implementation
}
```

## Utility Functions

### API Configuration

```typescript
import {
  createApiApp,
  configureApiApp,
  initOpenapi
} from '@onivoro/server-common';

// Create NestJS application with default settings
const app = await createApiApp(AppModule);

// Configure with custom settings
await configureApiApp(app, {
  cors: true,
  globalPrefix: 'api',
  port: 3000
});

// Initialize OpenAPI/Swagger
initOpenapi(app, {
  title: 'My API',
  description: 'API Documentation',
  version: '1.0.0'
});
```

### Environment and Package Utilities

```typescript
import {
  loadDotEnvForKey,
  getPackageVersion,
  parsePackageJson,
  generateAppMetadata
} from '@onivoro/server-common';

// Load environment file
loadDotEnvForKey('development');

// Get package version (async)
const version = await getPackageVersion();

// Parse package.json
const packageInfo = parsePackageJson();

// Generate app metadata
const metadata = generateAppMetadata();
```

### File Operations

```typescript
import {
  readFileAsJson,
  saveFileAsJson,
  readSslCertificate
} from '@onivoro/server-common';

// Read JSON file
const data = await readFileAsJson<ConfigType>('config.json');

// Save JSON file
await saveFileAsJson('output.json', { data: 'value' });

// Read SSL certificate
const cert = await readSslCertificate('cert.pem');
```

### String and Code Generation

```typescript
import {
  getRandomString,
  generateUniqueCode,
  generateFirestoreId,
  encode,
  decode
} from '@onivoro/server-common';

// Random string
const random = getRandomString(16);

// Unique code (6 characters)
const code = generateUniqueCode();

// Firestore-style ID
const id = generateFirestoreId();

// Base64 encoding/decoding
const encoded = encode('hello world');
const decoded = decode(encoded);
```

### Database Utilities

```typescript
import { asInsert } from '@onivoro/server-common';

// Convert object to INSERT statement
const sql = asInsert('users', {
  name: 'John',
  email: 'john@example.com',
  created_at: new Date()
});
// Returns: INSERT INTO users (name, email, created_at) VALUES ($1, $2, $3)
```

### System Utilities

```typescript
import {
  getMemoryStats,
  isPortInUse,
  shell,
  tryCatch
} from '@onivoro/server-common';

// Memory statistics
const stats = getMemoryStats();

// Check if port is in use
const inUse = await isPortInUse(3000);

// Execute shell command
const result = await shell('ls -la');

// Try-catch wrapper
const [result, error] = await tryCatch(async () => {
  return await riskyOperation();
});
```

### Request Parsing

```typescript
import { parseBody } from '@onivoro/server-common';

// Parse request body
app.use((req, res, next) => {
  parseBody(req, (err, body) => {
    if (err) return next(err);
    req.body = body;
    next();
  });
});
```

## Providers

### Version Provider

```typescript
import { VersionProvider, VERSION_PROVIDER_TOKEN } from '@onivoro/server-common';

@Module({
  providers: [VersionProvider],
  exports: [VERSION_PROVIDER_TOKEN]
})
export class AppModule {}

// Inject in service
@Injectable()
export class AppService {
  constructor(
    @Inject(VERSION_PROVIDER_TOKEN) private version: string
  ) {}
}
```

## Constants

```typescript
import {
  API_ID_HEADER,
  API_KEY_HEADER
} from '@onivoro/server-common';

// Use in guards or middleware
const apiKey = request.headers[API_KEY_HEADER];
const apiId = request.headers[API_ID_HEADER];
```

## Module Factory

```typescript
import { moduleFactory } from '@onivoro/server-common';

// Create dynamic module with environment config
const MyModule = moduleFactory({
  providers: [MyService],
  exports: [MyService]
});
```

## Complete Example

```typescript
import {
  ServerCommonModule,
  DefaultApiController,
  ApiResponsePaged,
  QueryPagedParams,
  PagedResponseDto,
  EnvironmentClass,
  ZodValidationPipe,
  getPackageVersion,
  ErrorFilter
} from '@onivoro/server-common';
import { z } from 'zod';

// Configuration
@EnvironmentClass()
class AppConfig {
  PORT: number = 3000;
  DATABASE_URL: string;
}

// DTO
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

// Controller
@DefaultApiController('users')
export class UsersController {
  @Get()
  @ApiResponsePaged(UserDto)
  async findAll(@QueryPagedParams() params: any): Promise<PagedResponseDto<UserDto>> {
    const users = await this.userService.findAll(params);
    return {
      data: users.data,
      total: users.total,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  }

  @Post()
  create(@Body(new ZodValidationPipe(UserSchema)) user: z.infer<typeof UserSchema>) {
    return this.userService.create(user);
  }
}

// Bootstrap
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ErrorFilter());
  
  const version = await getPackageVersion();
  console.log(`Starting app v${version}`);
  
  await app.listen(3000);
}
```

## License

MIT