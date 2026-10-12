#!/usr/bin/env node
import { CliUsageError, run } from './lib/cli';

run(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof CliUsageError ? err.message : err);
  process.exit(1);
});
