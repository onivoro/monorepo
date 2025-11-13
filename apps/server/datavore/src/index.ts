import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppServerDatavoreModule } from './app/app-server-datavore.module';

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppServerDatavoreModule,
    { logger: console }
  );

  // Serve static assets (including client bundles)
  app.useStaticAssets(join(__dirname, 'assets'), {
    prefix: '/assets/',
  });

  const port = process.env.PORT!;
  await app.listen(port);
  console.log(`DataVore available at: http://localhost:${port}`);
}