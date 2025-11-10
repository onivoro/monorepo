import { NestFactory } from '@nestjs/core';
import { AppServerBucketvoreModule } from './app/app-server-bucketvore.module';
import { AppServerBucketvoreConfig } from './app/app-server-bucketvore-config.class';

export async function bootstrap() {
  const app = await NestFactory.create(AppServerBucketvoreModule, { logger: console });
  const port = Number(new AppServerBucketvoreConfig().HTTP_PORT);
  await app.listen(port);
  console.log(`BucketVore available at: http://localhost:${port}`);
}
