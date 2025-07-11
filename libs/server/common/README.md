# @onivoro/server-common

A comprehensive collection of common server utilities, DTOs, decorators, pipes, and functions for building robust NestJS applications. This library provides foundational components used across enterprise-scale server applications.

## Installation

```bash
npm install @onivoro/server-common
```

## Features

- **NestJS Module**: Ready-to-import server common module
- **Error Handling**: Advanced error filters for TypeORM and general exceptions
- **API Decorators**: OpenAPI documentation decorators and response formatters
- **DTOs**: Common data transfer objects for typical API operations
- **Validation Pipes**: Custom pipes for data parsing and validation
- **Utility Functions**: Helper functions for API creation, encoding, file operations, and more
- **Environment Management**: Environment variable handling and configuration
- **Application Bootstrap**: Functions for creating and configuring API applications

## Quick Start

### Import the Module

```typescript
import { ServerCommonModule } from '@onivoro/server-common';

@Module({
  imports: [ServerCommonModule],
  // ...
})
export class AppModule {}
```

### Using API Configuration

```typescript
import { createApiApp, configureApiApp } from '@onivoro/server-common';

async function bootstrap() {
  const app = await createApiApp(AppModule);
  await configureApiApp(app, {
    port: 3000,
    title: 'My API',
    version: '1.0.0'
  });
}
```

### Environment Configuration

```typescript
import { EnvironmentClass } from '@onivoro/server-common';

@EnvironmentClass()
export class AppConfig {
  @EnvironmentVariable('DATABASE_URL')
  databaseUrl: string;

  @EnvironmentVariable('PORT', '3000')
  port: number;
}
```

## Configuration

The library provides several configuration utilities:

### Environment Variables

```typescript
import { loadDotEnvForKey } from '@onivoro/server-common';

// Load environment variables for a specific key
loadDotEnvForKey('development');
```

### Version Management

```typescript
import { getPackageVersion, VERSION_PROVIDER_TOKEN } from '@onivoro/server-common';

// Get version from package.json
const version = getPackageVersion();

// Use as provider
@Module({
  providers: [
    {
      provide: VERSION_PROVIDER_TOKEN,
      useValue: getPackageVersion()
    }
  ]
})
export class AppModule {}
```

## Usage Examples

### Error Handling

```typescript
import { ErrorFilter, TypeormErrorFilter } from '@onivoro/server-common';

@UseFilters(new ErrorFilter(), new TypeormErrorFilter())
@Controller('api')
export class ApiController {
  // Your controller methods
}
```

### API Documentation Decorators

```typescript
import { 
  DefaultApiController, 
  ApiResponsePaged, 
  ApiQueryPagedParams 
} from '@onivoro/server-common';

@DefaultApiController('users')
export class UsersController {
  @Get()
  @ApiQueryPagedParams()
  @ApiResponsePaged(UserDto)
  async findAll(@QueryPagedParams() params: PageParams) {
    // Implementation
  }
}
```

### Common DTOs

```typescript
import { 
  PagedResponseDto, 
  SuccessDto, 
  HealthDto,
  EmailDto 
} from '@onivoro/server-common';

@Get('health')
async getHealth(): Promise<HealthDto> {
  return { status: 'ok', timestamp: new Date() };
}

@Post('send-email')
async sendEmail(@Body() emailDto: EmailDto): Promise<SuccessDto> {
  // Send email logic
  return { success: true };
}
```

### Validation Pipes

```typescript
import { 
  ParseDateOptionalPipe, 
  ParseUuidOptionalPipe,
  ZodValidationPipe 
} from '@onivoro/server-common';

@Get('events')
async getEvents(
  @Query('date', ParseDateOptionalPipe) date?: Date,
  @Query('userId', ParseUuidOptionalPipe) userId?: string
) {
  // Implementation
}
```

### Utility Functions

```typescript
import { 
  generateUniqueCode,
  getRandomString,
  encode,
  decode,
  shell,
  tryCatch
} from '@onivoro/server-common';

// Generate unique codes
const code = generateUniqueCode(8);

// Random string generation
const randomStr = getRandomString(16);

// Encoding/decoding
const encoded = encode('sensitive data');
const decoded = decode(encoded);

// Shell command execution
const result = await shell('ls -la');

// Safe function execution
const [error, result] = await tryCatch(async () => {
  return await someAsyncOperation();
});
```

### File Operations

```typescript
import { 
  readFileAsJson,
  saveFileAsJson,
  parsePackageJson 
} from '@onivoro/server-common';

// Read JSON file
const config = await readFileAsJson('./config.json');

// Save JSON file
await saveFileAsJson('./output.json', { data: 'example' });

// Parse package.json
const packageInfo = parsePackageJson('./package.json');
```

### Application Metadata

```typescript
import { generateAppMetadata } from '@onivoro/server-common';

const metadata = generateAppMetadata({
  name: 'My API',
  version: '1.0.0',
  description: 'Example API'
});
```

## API Reference

### Core Functions

- **createApiApp(module)**: Create NestJS application
- **configureApiApp(app, options)**: Configure API with OpenAPI, CORS, etc.
- **moduleFactory(module, options)**: Create dynamic modules
- **initOpenapi(app, config)**: Initialize OpenAPI documentation

### Utility Functions

- **encode(data)**: Encode sensitive data
- **decode(data)**: Decode sensitive data
- **generateUniqueCode(length)**: Generate unique alphanumeric codes
- **getRandomString(length)**: Generate random strings
- **shell(command)**: Execute shell commands
- **tryCatch(fn)**: Safe async function execution

### File Operations

- **readFileAsJson(path)**: Read and parse JSON files
- **saveFileAsJson(path, data)**: Save data as JSON file
- **parsePackageJson(path)**: Parse package.json files

### Environment

- **loadDotEnvForKey(key)**: Load environment variables
- **getPackageVersion()**: Get current package version
- **isPortInUse(port)**: Check if port is available

### Memory and Performance

- **getMemoryStats()**: Get Node.js memory statistics

## DTOs

### Common DTOs

- **SuccessDto**: Standard success response
- **HealthDto**: Health check response
- **EmailDto**: Email data transfer object
- **PagedResponseDto**: Paginated response wrapper
- **LookupDto**: Key-value lookup objects

### Request DTOs

- **BodyDto**: Generic request body
- **UserIdDto**: User ID parameter
- **ValueDto/ValuesDto**: Generic value containers

## Decorators

### API Documentation

- **@DefaultApiController**: Standard API controller decorator
- **@ApiResponsePaged**: Paginated response documentation
- **@ApiQueryPagedParams**: Paginated query parameters
- **@ApiBodyUnspecified**: Unspecified request body
- **@ApiResponseUnspecified**: Unspecified response

### Environment

- **@EnvironmentClass**: Mark classes for environment variable injection

### Query Parameters

- **@QueryPagedParams**: Extract pagination parameters

## Error Handling

The library provides comprehensive error handling:

- **ErrorFilter**: General application error filter
- **TypeormErrorFilter**: Database-specific error handling
- **Structured Error Responses**: Consistent error response format

## Best Practices

1. **Use Type Safety**: Leverage TypeScript for all DTOs and interfaces
2. **Environment Configuration**: Use `@EnvironmentClass` for configuration
3. **Error Handling**: Apply error filters at the controller level
4. **API Documentation**: Use provided decorators for OpenAPI documentation
5. **Validation**: Use custom pipes for input validation
6. **Pagination**: Use provided pagination utilities for list endpoints

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.