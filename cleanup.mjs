import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const filesToRemove = [
  'libs/isomorphic/common/.npmignore',
  'libs/server/aws-cloudwatch/.npmignore',
  'libs/server/aws-cognito/.npmignore',
  'libs/server/aws-credential-providers/.npmignore',
  'libs/server/aws-ecs/.npmignore',
  'libs/server/aws-iam/.npmignore',
  'libs/server/aws-kinesis/.npmignore',
  'libs/server/aws-redshift/.npmignore',
  'libs/server/aws-s3/.npmignore',
  'libs/server/aws-sns/.npmignore',
  'libs/server/aws-sqs/.npmignore',
  'libs/server/aws-sts/.npmignore',
  'libs/server/cli/.npmignore',
  'libs/server/common/.npmignore',
  'libs/server/mcp/.npmignore',
  'libs/server/open-ai/.npmignore',
  'libs/server/pino/.npmignore',
  'libs/server/process/.npmignore',
  'libs/server/resilience/.npmignore',
  'libs/server/sendgrid/.npmignore',
  'libs/server/twilio/.npmignore',
  'libs/server/typeorm-mysql/.npmignore',
  'libs/server/typeorm-postgres/.npmignore',
  'libs/isomorphic/axios/.npmignore'
];

async function removeFiles() {
  let removed = 0;
  
  for (const file of filesToRemove) {
    try {
      if (existsSync(file)) {
        await unlink(file);
        console.log(`✓ Removed: ${file}`);
        removed++;
      } else {
        console.log(`- Not found: ${file}`);
      }
    } catch (error) {
      console.error(`✗ Error removing ${file}:`, error.message);
    }
  }
  
  console.log(`\nRemoved ${removed} out of ${filesToRemove.length} .npmignore files.`);
}

removeFiles().catch(console.error);