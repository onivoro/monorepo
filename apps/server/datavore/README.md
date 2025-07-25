# DataVore Server Application

A NestJS-based data processing and management server application.

## Description

DataVore is a server application built with NestJS that provides data processing and management capabilities. It's designed to handle various data operations and can be deployed as a standalone service.

## Installation

```bash
npm install @onivoro/app-server-datavore
```

## Usage

### As a CLI Tool

```bash
npx datavore
```

### Programmatic Usage

```javascript
import { bootstrap } from '@onivoro/app-server-datavore';

// Start the server
bootstrap();
```

## Configuration

The application uses environment variables for configuration:

- `PORT` - The port number for the server to listen on

## Development

This package is part of the Onivoro monorepo and is built using Nx.

## License

MIT
