import { NestFactory } from '@nestjs/core';
import { AppServerBucketvoreModule } from './app/app-server-bucketvore.module';

export async function bootstrap() {
  const app = await NestFactory.create(AppServerBucketvoreModule, { logger: console });
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`BucketVore available at: http://localhost:${port}`);
}
