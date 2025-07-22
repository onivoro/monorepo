import { NestFactory } from '@nestjs/core';
import { AppServerDatavoreModule } from './app/app-server-datavore.module';

async function bootstrap() {
  const app = await NestFactory.create(AppServerDatavoreModule, { logger: console });
  const port = process.env.PORT!;
  await app.listen(port);
  console.log(`DataVore available at: http://localhost:${port}`);
}

bootstrap();
