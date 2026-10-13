# @onivoro/server-aws-ssm

Load config classes from AWS Systems Manager Parameter Store, the way `EnvironmentClass` from [`@onivoro/server-common`](../common/) loads them from `process.env`.

## Installation

```bash
npm install @onivoro/server-aws-ssm @aws-sdk/client-ssm @aws-sdk/credential-providers @nestjs/common reflect-metadata
```

## Usage

Decorate a config class with `SSMEnvironmentClass(keyMapper, options?)`, then load it with `loadSSMEnvironment` before building your Nest modules. Loading is asynchronous because it calls SSM, so it can't happen in a constructor.

```typescript
import { EnvRequired, SSMEnvironmentClass, loadSSMEnvironment } from '@onivoro/server-aws-ssm';

// ENV_FILE=.env.production node main.js
@SSMEnvironmentClass((member, className) => `/${process.env.STAGE}/api/${member}`, { envFileKey: 'ENV_FILE' })
export class AppConfig {
  @EnvRequired() DATABASE_URL!: string;
  @EnvRequired() API_KEY!: string;
  SENTRY_DSN?: string;
  LOG_LEVEL = 'info';
}

// main.ts
const config = await loadSSMEnvironment(AppConfig); // typed as AppConfig
const app = await NestFactory.create(AppModule.configure(config));
```

Properties are declared the same way as for [`EnvironmentClass`](../common/#declaring-properties). Use `@EnvRequired()` for values that must be present and `@EnvOptional()` for ones that may be empty, and use an initializer only for a real default. An undecorated property with no initializer, like `SENTRY_DSN?: string`, is found only when the class is compiled with `useDefineForClassFields: true` (the default for `target` `ES2022` or later). `EnvRequired` and `EnvOptional` are re-exported from this package, so they come from the same copy of `@onivoro/server-common` that the loader reads.

### The key mapper

The key mapper is a `(member: string, className: string) => string` function, called once for each property during `loadSSMEnvironment`. It returns the SSM parameter for that property: a name (`/prod/api/DATABASE_URL`), an ARN, or a name with a version or label selector (`/prod/api/DATABASE_URL:3`). It should be deterministic. It runs after the `.env` file named by `envFileKey` is loaded, so it can read values such as `STAGE` from it. If it returns an empty or non-string key, loading throws. Several properties may map to the same parameter, which is fetched once.

### Resolution order

For each property, `loadSSMEnvironment` uses the first of:

1. `process.env[<property name>]`, when defined. Properties set this way are not requested from SSM, so a `.env.local` or shell variable overrides SSM without calling AWS. This includes empty values: a `.env` file line like `DATABASE_URL=` sets the variable to `''`, which also stops it being fetched from SSM. Leave a variable out of `.env` files entirely when it should come from SSM.
2. The SSM parameter value.
3. The initializer value.

Parameters that SSM reports as not found count as missing, and their names are logged once as `<ClassName> SSM PARAMETERS NOT FOUND <key>, <key>`. That includes parameters whose property falls back to an initializer. A key with a typo and a parameter that hasn't been created yet both appear there; parameter names are logged, never values.

Empty means `undefined`, `null` or `''`. If any `@EnvRequired()` property ends up empty, loading throws one error listing them all, `<ClassName> is missing required values: <property> (SSM key <key>), ...`. For each undecorated property that ends up empty, it logs `<ClassName> MISSING ENV VAR OR SSM PARAMETER <property> (SSM key <key>)`. `@EnvOptional()` properties are never warned about.

It returns a plain object, like `EnvironmentClass`.

### Inheritance

A decorated class can extend another decorated class (`@SSMEnvironmentClass` or `EnvironmentClass`). Load the subclass. Its key mapper and options apply to every property, including inherited ones, and the parent's decorator does nothing while the subclass is being loaded. An undecorated subclass of a decorated class can't be loaded, and `loadSSMEnvironment` throws `<ClassName> is not decorated with @SSMEnvironmentClass`. Decorate the subclass so its own properties aren't silently dropped.

### Options

Pass options to the decorator, or to `loadSSMEnvironment(Cls, overrides)`, where they override the decorator's options key by key.

| Option               | Default | Effect                                                                                                                                                                                                                                                                                     |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `envFileKey`         | none    | Load the `.env` file whose path is in `process.env[envFileKey]` (plus `.env.local` if present) first, via `loadDotEnvForKey`.                                                                                                                                                              |
| `withDecryption`     | `true`  | Passed as `WithDecryption` to `GetParameters`, so `SecureString` values come back decrypted.                                                                                                                                                                                               |
| `exportToProcessEnv` | `false` | Copy each value read from SSM into `process.env[<property name>]`, for code that reads the environment directly. Existing variables are not changed. This includes decrypted `SecureString` values, which child processes then inherit and anything that dumps the environment can expose. |
| `client`             | none    | The `SSMClient` to use.                                                                                                                                                                                                                                                                    |

Without `client`, an `SSMClient` is created with its region from `process.env.AWS_REGION` only. A region property or initializer on the config class isn't used, because the client is needed before the class is loaded. Credentials come from `process.env.AWS_PROFILE` via [`@onivoro/server-aws-credential-providers`](../aws-credential-providers/). When no profile is set, the AWS SDK default credential chain applies. The client is created only when there is something to fetch.

Parameters are fetched with `GetParameters`, up to 10 names per request, and requests run in parallel. Many processes starting at once, such as a large ECS deployment, can reach SSM's API throughput limit. The default client then relies on the AWS SDK's standard retries (3 attempts); pass a `client` built with a higher `maxAttempts` if that isn't enough. The caller needs `ssm:GetParameters`, and `kms:Decrypt` for `SecureString` parameters encrypted with a customer-managed key.

### Constructing the class directly

`new AppConfig()` still works synchronously. It behaves like `EnvironmentClass`: it loads `envFileKey` and reads only `process.env` and initializers. The first time each class is constructed this way, it logs `<ClassName> was constructed without SSM values; use loadSSMEnvironment(<ClassName>)`. That makes it usable in tests and local runs without AWS. `@EnvRequired()` properties are still enforced, so set them in `process.env` when constructing this way.

## ssmPathMapper

`ssmPathMapper(prefix, { case? })` builds a key mapper that puts each property under a path prefix.

```typescript
import { EnvRequired, SSMEnvironmentClass, ssmPathMapper } from '@onivoro/server-aws-ssm';

@SSMEnvironmentClass(ssmPathMapper(() => `/${process.env.STAGE}/api`, { case: 'kebab' }))
export class AppConfig {
  @EnvRequired() DATABASE_URL!: string; // STAGE=prod → /prod/api/database-url
}
```

- **`prefix`** is a string, or a function that returns one. Use a function when the prefix depends on values loaded from `envFileKey`, because decorator arguments are evaluated when the class is defined, before the file is loaded. Leading, trailing, and repeated slashes are normalized, and the result always starts with `/`.
- **`case`** can be:
  - `'preserve'` (the default): `DATABASE_URL`;
  - `'kebab'`: `DATABASE_URL` and `databaseUrl` both become `database-url`;
  - `'lower'`: `database_url`.
- The mapper throws if the resulting path contains characters other than letters, digits, `_`, `.`, `-`, and `/`.

## License

MIT
