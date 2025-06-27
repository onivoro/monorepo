import { DocumentBuilder } from '@nestjs/swagger';
import { initOpenapi } from './init-openapi.function';
import { NestFactory } from '@nestjs/core';
import * as bodyParser from 'body-parser';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestApplicationOptions } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export type TApiAppConfig = {
  project: string,
  appRoot: string,
  corsOptions?: CorsOptions,
  globalPrefix?: string,
  title?: string,
  version?: string,
  documentBuilder?: (documentBuilder: DocumentBuilder) => DocumentBuilder,
  enableSecurityHeaders?: boolean,
};

/**
 * Middleware to set security headers
 */
function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Force HTTPS in production
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy - restrictive but can be customized per application
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;");

  // Feature policy to control browser features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

export async function configureApiApp(
  module: { name: string },
  options: TApiAppConfig,
  nestApplicationOptions?: NestApplicationOptions
) {

  const {
    project,
    appRoot,
    corsOptions,
    globalPrefix,
    title,
    version,
    documentBuilder,
    enableSecurityHeaders = false,
  } = options;

  const app = await NestFactory.create(module, nestApplicationOptions);

  // Apply security headers if enabled (default: true)
  if (enableSecurityHeaders) {
    app.use(securityHeadersMiddleware);
  }

  if(globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }
  app.enableCors(corsOptions);
  app.enableShutdownHooks();
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  await initOpenapi(app, title || module.name, project, appRoot, version, documentBuilder);

  return app;
}
