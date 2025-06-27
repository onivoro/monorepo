import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'path';
import { writeFile } from 'fs/promises';
import { INestApplication } from '@nestjs/common';
import { generateAppMetadata } from './generate-app-metadata.function';

export async function initOpenapi(app: INestApplication, title: string, projectName: string, appRoot: string, version?: string, documentBuilder?: (document: DocumentBuilder) => DocumentBuilder) {
  const { swaggerJsonPath } = generateAppMetadata(projectName, appRoot);

  const _documentBuilder = new DocumentBuilder()
    .setTitle(title)
    .setDescription('')
    .setVersion(version || '0.0.0');

  const options = (documentBuilder ? documentBuilder(_documentBuilder) : _documentBuilder).build();

  const document = SwaggerModule.createDocument(app, options);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`writing swagger JSON file to ${swaggerJsonPath}`)
    await writeFile(resolve(swaggerJsonPath), JSON.stringify(document, null, 2));
  }

  SwaggerModule.setup('dox', app, document);

  return swaggerJsonPath;
}
