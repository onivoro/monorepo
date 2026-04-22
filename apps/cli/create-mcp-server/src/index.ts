#!/usr/bin/env node
import { run } from './lib/cli';

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
