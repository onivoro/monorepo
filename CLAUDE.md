# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-scale Nx monorepo, organized using domain-driven design principles. The codebase contains multiple shared libraries with comprehensive tooling for development, testing, and deployment.

## Essential Commands

### Build & Development
```bash
# Build all projects
npx nx run-many -t build

# Build specific project
npx nx build {project-name}

# Format code (required before commits)
npm run fmt

# Run Storybook for component development
npm run storybook
```

### Testing
```bash
# Run all tests safely
npm run test
# or
nx run-many -t test --passWithNoTests

# Test specific project
nx test {project-name}

# Test with coverage and watch mode
nx test {project-name} --coverage --watch

# Run E2E tests
nx playwright test-playwright-b2b
nx playwright test-playwright-rx

# Python tests
nx test pyvim
```

### Local Development
```bash
# Start local database
npm run db:up:local

# Stop local database
npm run db:down:local

# Run specific app locally (using custom executor)
nx local {app-name}

# TypeORM CLI with environment support
npm run typeorm -- {command}
```

### NX Commands
```bash
# Run executor for specific project
npx nx run {project}:{executor}

# Run executor for all projects that have it
npx nx run-many -t {executor}

# See what would run (dry run)
npx nx run-many -t {executor} --dry-run

# Run with specific project pattern
npx nx run-many -t test --projects="*b2b*"
```

## Architecture Overview

### Monorepo Structure
- **apps/**: Deployable applications organized by runtime
  - `browser/`: React web applications with Vite
  - `server/`: NestJS API applications
  - `cli/`: NestJS command-line tools
  - `lambda/`: AWS Lambda functions
  - `chrome/`: Chrome extensions
  - `task/`: AWS ECS tasks
- **libs/**: Reusable libraries organized by compatibility
  - `browser/`: Frontend-only libraries
  - `server/`: Backend-only libraries
  - `isomorphic/`: Shared between frontend/backend
  - `axios/`: Auto-generated API clients

### Configuration Pattern
- **Environment Variables**: Each app has a strongly-typed config class decorated with `@EnvironmentClass()`
- **TypeScript Configuration**: Layered configs with `tsconfig.base.json`, `tsconfig.server.json`, `tsconfig.web.json`
- **Path Mapping**: Comprehensive barrel exports using `@onivoro/*` namespace

### Database Architecture
- **Per-Domain ORMs**: Each business domain has its own ORM library (e.g., `@onivoro/server/b2b-orm`)
- **TypeORM Foundation**: Uses TypeORM with custom naming strategies
- **Multi-Database Support**: PostgreSQL and MySQL configurations
- **Migration Management**: Domain-specific migrations with `npm run typeorm`

### Authentication Patterns
- **Server Apps**: JWT + TOTP with abstract base classes (`AbstractAuthGuard`)
- **Browser Apps**: OIDC integration with Cognito/Entra ID
- **Role-Based Access**: Custom decorators for user context (`@UserId()`, `@CompanyId()`)

### API Architecture
- **Domain-Driven APIs**: Separate API servers per domain (b2b, warevim, rx, etc.)
- **OpenAPI Integration**: Auto-generated clients and documentation
- **Consistent Bootstrap**: All APIs use `configureApiApp()` helper
- **Global Patterns**: `/api` prefix, structured error handling, CORS configuration

## Custom Tooling

### @onivoro/onix Plugin
Custom Nx plugin providing specialized executors:
- `build-cli`: Build CLI apps with local shell binding
- `gen`: Generate OpenAPI clients using Docker
- `local`: Environment-aware local development
- `deploy`: Automated ECS deployment
- `docker`: Containerized local development

### Code Generation
- **API Clients**: Generated from OpenAPI specs, stored in `libs/axios/`
- **Documentation**: Auto-generated API docs in `api-dox/`
- **CLI Binaries**: Built CLIs available as `b2b`, `ivinesis`, `ods`, `rx`, `warevim`

## Development Patterns

### Adding New Features
1. Identify the appropriate domain (b2b, rx, warevim, etc.)
2. Add business logic to the corresponding server library
3. Create API endpoints in the server app
4. Generate API client: `nx gen {domain-api-app-name}`
5. Update frontend components using the generated client

### Database Changes
1. Create entity in the domain ORM library
2. Generate migration: `npm run typeorm -- migration:generate -d {dataSource} {MigrationName}`
3. Run migration: `npm run typeorm -- migration:run -d {dataSource}`

### Testing Requirements
- **Unit Tests**: Required for all new functionality
- **Integration Tests**: Required for API endpoints
- **E2E Tests**: Required for user-facing features
- **Type Checking**: Run `nx tsc:typecheck {project}` before commits

### Environment Setup
- **AWS Credentials**: Configure `~/.aws/credentials` with AWS profile names
- **Environment Files**: Each app requires environment files matching the config class
- **Local Database**: Use `npm run db:up:local` for local development


### React Code in apps/browser/ Subdirectories

1. **Material-UI Components**:
   - Always use `@mui/material` components instead of any alternatives (e.g., antd, chakra-ui, react-bootstrap)
   - Use `@mui/icons-material` for all icon requirements instead of other icon libraries
   - Follow Material-UI's theming and styling patterns
   - Leverage Material-UI's built-in TypeScript support

2. **Component Imports**:
   - **FORBIDDEN**: Importing from `@onivoro/browser/components` is strictly prohibited unless the prompt explicitly indicates otherwise
   - Prefer Material-UI components for all UI needs
   - Only use custom components from `@onivoro/browser/components` when specifically requested or when Material-UI doesn't provide the required functionality

3. **Styling**:
   - Use Material-UI's styling solutions (sx prop, theme-based styling, or Material-UI's styled API)
   - **FORBIDDEN**: Do not use styled-components library or Tailwind CSS or CSS rules in stylesheets
   - **FORBIDDEN**: Do not use any CSS-in-JS libraries other than Material-UI's built-in styling
   - **FORBIDDEN**: Never use `color` or `backgroundColor` properties in sx props, including pseudo states (`:hover`, `:focus`, etc.)
   - Maintain consistency with Material-UI's design system
   - Prefer the `sx` prop for component-level styling
   - Use Material-UI's theme palette and color variants instead of direct color values

4. **State Management**:
   - **PREFERRED**: Use Redux via Redux Toolkit (@reduxjs/toolkit) for all state management needs
   - **FORBIDDEN**: Do not use other state management solutions (Zustand, Jotai, Valtio, Context API for global state, etc.) unless explicitly requested
   - **FORBIDDEN**: Do not use RTK Query for data fetching
   - Follow Redux Toolkit patterns: createSlice, createAsyncThunk, configureStore
   - Prefer Redux Toolkit's built-in TypeScript support

5. **Context API Usage**:
   - When using `useContext`, follow the strict naming convention: `const [foo, fooAs] = useContext('whatever');`
   - The first variable should be the base name, the second should be the base name with "As" suffix
   - This convention ensures consistency and readability across all context usage in the codebase


## Key Libraries and Frameworks

### Frontend Stack
- **React 18**: All browser applications
- **Redux Toolkit**: State management
- **Tailwind CSS**: Styling framework
- **Vite**: Build system
- **React Hook Form**: Form handling

### Backend Stack
- **NestJS**: API framework
- **TypeORM**: Database ORM
- **Pino**: Structured logging
- **JWT + TOTP**: Authentication
- **AWS SDK**: Cloud integrations

### Development Tools
- **Jest**: Unit testing
- **Playwright**: E2E testing
- **Storybook**: Component development
- **ESLint/Prettier**: Code formatting
- **Docker**: Local development environment

## Common Pitfalls

### Environment Configuration
- Always check the config class for exact environment variable names
- Environment files must match the naming convention: `.env.{app}.{environment}`
- Use `@EnvironmentClass()` decorator for all configuration classes

### Database Connections
- Each domain has its own database connection and ORM
- Use the appropriate data source for migrations
- Bastion connectivity is automatically checked for production databases

### Testing
- Use `--passWithNoTests` flag to avoid failures on projects without tests
- E2E tests use `.test.ts` extension, unit tests use `.spec.ts`
- Always run tests before committing: `npm run test`

### NX Project References
- Maintain proper dependency graphs between libraries
- Use appropriate library types (browser/server/isomorphic)
- Follow the monorepo structure conventions for new projects