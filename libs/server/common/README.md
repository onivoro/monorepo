# @onivoro/server-common

Common server utilities, DTOs, decorators, pipes, and bootstrap helpers for NestJS applications.

## Installation

```bash
npm install @onivoro/server-common
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `body-parser`, `reflect-metadata`, `rxjs`, `typeorm`, `zod`. The error filters and bootstrap helpers assume the Express platform (`@nestjs/platform-express`). Depends on [`@onivoro/isomorphic-common`](../../isomorphic/common/).

## Module Setup

`ServerCommonModule` registers a `GET /health` endpoint and the `versionProvider` (the `version` from `./package.json`, or `'0.0.0'` if it can't be read).

```typescript
import { Module } from '@nestjs/common';
import { ServerCommonModule } from '@onivoro/server-common';

@Module({
  imports: [ServerCommonModule],
})
export class AppModule {}
```

`GET /health` returns a `HealthDto`: `{ free, total, percentUtilization, version }` (memory figures from `os.freemem()` / `os.totalmem()`). The controller is tagged `Default` in OpenAPI.

## Bootstrapping

### configureApiApp

Creates (but does not start) a Nest app: optional global prefix and security headers, CORS, shutdown hooks, 50mb JSON/urlencoded body limits, and OpenAPI via `initOpenapi`.

```typescript
import { configureApiApp } from '@onivoro/server-common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await configureApiApp(
    AppModule,
    {
      project: 'api-orders', // used for the swagger JSON file name
      appRoot: 'apps/api-orders',
      globalPrefix: 'api', // optional; not set if omitted
      corsOptions: { origin: ['https://example.com'] },
      title: 'Orders API', // defaults to the module class name
      version: '1.2.0', // defaults to '0.0.0'
      documentBuilder: (b) => b.addBearerAuth(),
      enableSecurityHeaders: true, // default false
    },
    { logger: ['error', 'warn', 'log'] }, // optional NestApplicationOptions
  );

  await app.listen(3000);
}
```

`TApiAppConfig` is the exported type of the options object. With `enableSecurityHeaders`, every response gets `X-XSS-Protection`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`, a restrictive `Content-Security-Policy`, and `Permissions-Policy`.

### createApiApp

Older one-shot variant that also calls `app.listen(port)`. Signature: `createApiApp(module, port, project, appRoot, corsOptions?, globalPrefix = 'api')`.

```typescript
import { createApiApp } from '@onivoro/server-common';

const app = await createApiApp(AppModule, 3000, 'api-orders', 'apps/api-orders');
```

### initOpenapi

`initOpenapi(app, title, projectName, appRoot, version?, documentBuilder?)` builds the OpenAPI document, serves Swagger UI at `/dox`, and returns the swagger JSON path. When `NODE_ENV !== 'production'` it also writes the document, sorted with `sortOpenApiDocument`, to `api-dox/<projectName>.json` (relative to the working directory; the `api-dox` directory must exist).

```typescript
import { initOpenapi } from '@onivoro/server-common';

await initOpenapi(app, 'Orders API', 'api-orders', 'apps/api-orders', '1.2.0');
```

### sortOpenApiDocument

`sortOpenApiDocument<T>(document: T): T` returns a copy with object keys sorted at every depth, `tags` sorted by `name`, and each operation's `parameters` sorted by `in`, then `name`. This makes the generated JSON stable for diffs.

## Error Filters

### ErrorFilter

Catches `InternalServerErrorException` only, logs the message, and replies `500` with the message as the body.

```typescript
import { UseFilters, Controller } from '@nestjs/common';
import { ErrorFilter } from '@onivoro/server-common';

app.useGlobalFilters(new ErrorFilter());

// or per controller
@UseFilters(ErrorFilter)
@Controller('users')
export class UsersController {}
```

### TypeormErrorFilter

Catches TypeORM `QueryFailedError`, `EntityNotFoundError`, and `EntityPropertyNotFoundError` and replies with a JSON string `"<label>: <error message>"`:

| Error                                         | Status | Label                           |
| --------------------------------------------- | ------ | ------------------------------- |
| `QueryFailedError` containing `null value`    | 400    | `QueryFailedError.NullValue`    |
| `QueryFailedError` containing `duplicate key` | 409    | `QueryFailedError.DuplicateKey` |
| `QueryFailedError` (anything else)            | 400    | `QueryFailedError`              |
| `EntityNotFoundError`                         | 404    | `EntityNotFoundError`           |
| `EntityPropertyNotFoundError`                 | 400    | `EntityPropertyNotFoundError`   |

```typescript
import { TypeormErrorFilter } from '@onivoro/server-common';

app.useGlobalFilters(new TypeormErrorFilter());
```

## Decorators

### API Documentation Decorators

```typescript
import { Body, Get, Post } from '@nestjs/common';
import { ApiBodyUnspecified, ApiQueryPagedParams, ApiQuerySortParams, ApiResponsePaged, ApiResponseUnspecified, ApiResponseUnspecifiedArray, DefaultApiController, PagedResponseDto, QueryPagedParams, QuerySortParams, TQueryPagedParams, TQuerySortParams } from '@onivoro/server-common';

@DefaultApiController('users') // @Controller('users') + @ApiTags('Default')
export class UsersController {
  @Get()
  @ApiResponsePaged(UserDto) // PagedResponseDto schema with data: UserDto[]
  @ApiQueryPagedParams() // documents optional pagingKey and pageSize
  @ApiQuerySortParams() // documents optional sortKey and sortDirection ('asc' | 'desc')
  findAll(@QueryPagedParams() paging: TQueryPagedParams, @QuerySortParams() sort: TQuerySortParams): Promise<PagedResponseDto<UserDto>> {
    return this.users.find(paging, sort);
  }

  @Post()
  @ApiBodyUnspecified() // body schema: free-form object
  @ApiResponseUnspecified() // response schema: free-form object
  create(@Body() data: Record<string, unknown>) {}

  @Get('list')
  @ApiResponseUnspecifiedArray() // response schema: array of free-form objects
  getList() {}
}
```

`DefaultApiController(args)` forwards `args` to `@Controller` unchanged.

### Query Parameter Decorators

- `QueryPagedParams()` reads `pageSize` and `pagingKey` (or lowercase `pagesize`/`pagingkey`) from the query string and returns `{ pageSize?: number, pagingKey?: number }` (`TQueryPagedParams`). Non-numeric or zero values become `undefined`.
- `QuerySortParams()` reads `sortKey` and `sortDirection` (or lowercase variants) and returns `{ sortKey?: string, sortDirection?: 'asc' | 'desc' }` (`TQuerySortParams`). Values are passed through without validation.

### EnvironmentClass

`EnvironmentClass(envFileKey?)` turns a class into a config object populated from `process.env`. If `envFileKey` is given, `process.env[envFileKey]` is treated as a path to a `.env` file that is loaded first (plus `.env.local` if present), via `loadDotEnvForKey`. Constructing the class returns a plain object; each own property is set to `process.env[<property name>]` when that variable is defined, otherwise it keeps its initializer value, and `<ClassName> MISSING ENV VAR <key>` is logged when both the env value and the initializer are empty.

```typescript
import { EnvironmentClass } from '@onivoro/server-common';

// ENV_FILE=.env.development node main.js
@EnvironmentClass('ENV_FILE')
export class AppConfig {
  API_URL = '';
  DATABASE_URL = '';
}

const config = new AppConfig(); // { API_URL: process.env.API_URL ?? '', DATABASE_URL: process.env.DATABASE_URL ?? '' }
```

Give every property an initializer so it exists on the instance regardless of compiler settings. Initializers act as defaults: a defined env var (even an empty string) overrides them, an unset one leaves them in place.

## DTOs

All DTOs are classes with `@nestjs/swagger` property metadata.

| DTO                         | Shape                                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| `AccountUserDto`            | `{ email?: string; firstName?: string; lastName?: string; phone?: string }`     |
| `BodyDto`                   | `{ body: string }`                                                              |
| `EmailDto`                  | `{ email: string }`                                                             |
| `HealthDto`                 | `{ free: number; total: number; percentUtilization: number; version?: string }` |
| `LookupDto`                 | `{ value: string; display: string }` (implements `ILookup<string, string>`)     |
| `PagedResponseDto<TEntity>` | `{ data: TEntity[]; pagingKey: number; pageSize: number; total: number }`       |
| `PutPasswordDto`            | `{ current: string; updated: string; confirmed: string }`                       |
| `StringArrayDto`            | `{ body: string[] }`                                                            |
| `SuccessDto`                | `{ success: boolean }`                                                          |
| `UrlDto`                    | `{ url: string }`                                                               |
| `UserIdDto`                 | `{ userId: string }`                                                            |
| `ValueDto`                  | `{ value: string }`                                                             |
| `ValuesDto`                 | `{ values: string[] }`                                                          |

```typescript
import { PagedResponseDto, LookupDto } from '@onivoro/server-common';

const page: PagedResponseDto<UserDto> = { data: users, pagingKey: 1, pageSize: 10, total: 100 };
const option: LookupDto = { display: 'Option One', value: 'one' };
```

## Pipes

Pipes that take constructor arguments must be passed as instances (`new ...()`).

### Date Pipes

- `new ParseDateOptionalPipe(parse: boolean)`: empty values pass through. Otherwise the value must match `YYYY-MM-DD` and be a real calendar date (400 if not; impossible dates such as `2024-02-30` are rejected rather than rolled over). Returns a `Date` when `parse` is `true`, else the original string.
- `new ParseMonthPipe(propertyName = 'month')`: required; returns a number between 1 and 12.
- `new ParseYearPipe(propertyName = 'year', minYear = 2024)`: required; returns a number between `minYear` and the current UTC year.

```typescript
import { Get, Query } from '@nestjs/common';
import { ParseDateOptionalPipe, ParseMonthPipe, ParseYearPipe } from '@onivoro/server-common';

@Get('report')
report(
  @Query('month', new ParseMonthPipe()) month: number,
  @Query('year', new ParseYearPipe('year', 2020)) year: number,
  @Query('asOf', new ParseDateOptionalPipe(true)) asOf?: Date,
) {}
```

### UUID Pipes

- `ParseUUIDOptionalPipe`: returns `undefined` for empty values, otherwise validates with Nest's `ParseUUIDPipe({ version: '4' })`.
- `new ParseUUIDsPipe(property?)`: requires an array of v4 UUIDs, either the whole value or `value[property]`; 400 lists the invalid entries.

```typescript
import { Body, Get, Post, Query } from '@nestjs/common';
import { ParseUUIDOptionalPipe, ParseUUIDsPipe } from '@onivoro/server-common';

@Get()
find(@Query('ownerId', ParseUUIDOptionalPipe) ownerId?: string) {}

@Post('batch')
findMany(@Body(new ParseUUIDsPipe('ids')) body: { ids: string[] }) {}
```

### ZodValidationPipe

Validates with `schema.safeParse`. On success it returns the parsed data; on failure it throws `BadRequestException` whose body is the list of Zod issues (or `'Validation failed'`).

```typescript
import { Body, Post } from '@nestjs/common';
import { ZodValidationPipe } from '@onivoro/server-common';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Post()
create(@Body(new ZodValidationPipe(UserSchema)) user: z.infer<typeof UserSchema>) {}
```

## Providers and Constants

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { versionProvider, versionProviderToken, apiIdHeader, apiKeyHeader } from '@onivoro/server-common';

// versionProvider is already provided and exported by ServerCommonModule;
// list it in your own module's providers only if you don't import that module.
@Injectable()
export class AppService {
  constructor(@Inject(versionProviderToken) private version: string) {}
}

const apiKey = request.headers[apiKeyHeader]; // 'x-api-key'
const apiId = request.headers[apiIdHeader]; // 'x-api-id'
```

`versionProviderToken` is a `Symbol('version')`.

## moduleFactory

Builds `@Module` metadata whose `exports` are all of its `imports` and `providers`. `controllers` is included only when non-empty, and `module` is included when given (for dynamic modules).

```typescript
import { Module, DynamicModule } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';

@Module(moduleFactory({ imports: [HttpModule], providers: [MyService], controllers: [MyController] }))
export class MyModule {
  static forRoot(config: MyConfig): DynamicModule {
    return moduleFactory({
      module: MyModule,
      providers: [MyService, { provide: 'MY_CONFIG', useValue: config }],
    });
  }
}
```

## Utility Functions

### Environment and package.json

```typescript
import { loadDotEnvForKey, loadEnvFile, parsePackageJson, getPackageVersion, generateAppMetadata } from '@onivoro/server-common';

// Load the file whose path is in process.env.ENV_FILE (then .env.local, if present)
loadDotEnvForKey('ENV_FILE');

// Load a file directly; second argument controls the .env.local override (default true)
loadEnvFile('.env.test', false);

const pkg = await parsePackageJson(); // parsed ./package.json
const version = await getPackageVersion('apps/api/package.json');

generateAppMetadata('api-orders', 'apps/api-orders');
// { platform: 'api', app: 'orders', assetPath: 'apps/api-orders/src/assets',
//   packageJsonPath: 'apps/api-orders/package.json', swaggerJsonPath: 'api-dox/api-orders.json' }
```

`loadEnvFile` uses Node's `process.loadEnvFile` (Node 20.12+) and warns if the file does not exist.

### Files

```typescript
import { readFileAsJson, saveFileAsJson, readSslCertificate } from '@onivoro/server-common';

const config = await readFileAsJson('config.json'); // throws BadRequestException if unreadable or invalid JSON
await saveFileAsJson('output', { data: 'value' }); // writes output.json (".json" appended if missing)

// Returns undefined when PG_HOST is localhost/127.0.0.1/::1. In production (NODE_ENV=production)
// reads CERTIFICATE_PATH relative to cwd; otherwise reads `${MACHINE_PATH_PREFIX}/${CERTIFICATE_PATH}`.
const ca = readSslCertificate('apps/api', { PG_HOST: process.env.PG_HOST! }, 'assets/us-east-2-bundle.pem');
```

### Random strings and tokens

```typescript
import { getRandomString, generateUniqueCode, generateFirestoreId, encode, decode } from '@onivoro/server-common';

getRandomString(); // 32 hex chars (a v4 UUID without dashes)
getRandomString('user_', '_tmp'); // 'user_<32 hex chars>_tmp'

generateUniqueCode(); // 24 chars from [A-Za-z0-9-_~] (crypto.randomBytes)
generateUniqueCode(8);

generateFirestoreId(); // 20 alphanumeric chars (crypto.getRandomValues)
generateFirestoreId(28);

const token = encode({ sub: 'user-1' }); // '.<base64 JSON>.' (unsigned, JWT-shaped)
decode(token); // { sub: 'user-1' } - parses the middle segment of any JWT-shaped string
decode(undefined); // undefined
```

`decode` does not verify signatures.

### SQL generation (deprecated)

`asInsert(table, rows)` returns one literal `insert into "table" (...) values (...);` string per row. Strings are single-quoted without escaping, `null`/`undefined`/`'null'` become `null`, booleans `TRUE`/`FALSE`, and objects/arrays `'<json>'::jsonb`. Marked for deprecation; do not use with untrusted input.

```typescript
import { asInsert } from '@onivoro/server-common';

asInsert('users', [{ name: 'John', active: true, tags: ['a'] }]);
// [`insert into "users" ("name", "active", "tags") values ('John', TRUE, '["a"]'::jsonb);`]
```

### System and request helpers

```typescript
import { getMemoryStats, isPortInUse, shell, tryCatch, parseBody } from '@onivoro/server-common';

getMemoryStats(); // { free, total, percentUtilization } in bytes / percent used ((total - free) / total * 100)

await isPortInUse(3000); // true if binding localhost:3000 fails with EADDRINUSE; false if it can be bound (the probe server is closed) or fails for any other reason
await isPortInUse(3000, '127.0.0.1'); // optional host, default 'localhost'

const output = shell('git rev-parse HEAD'); // synchronous execSync; logs the command and output, returns stdout

// Awaits fn and rethrows any error as InternalServerErrorException(error.message)
const user = await tryCatch(() => usersService.findOne(id));

// JSON.parse(body['{}'])
const payload = parseBody<MyPayload>(req.body);
```

## License

MIT
