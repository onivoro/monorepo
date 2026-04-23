import * as fs from 'fs';
import * as path from 'path';
import type { ScaffoldOptions } from './types';

export function getLibVersion(): string {
  const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

export function getTemplatesDir(): string {
  return path.resolve(__dirname, '..', '..', 'templates');
}

export function applyReplacements(content: string, replacements: Record<string, string>): string {
  let result = content;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }
  return result;
}

export function processPackageJson(content: string, options: ScaffoldOptions, version: string): string {
  let result = applyReplacements(content, {
    __PROJECT_NAME__: options.projectName,
    __LIB_VERSION__: version,
  });

  if (options.auth) {
    result = result.replace(
      '__AUTH_DEP__',
      `    "@onivoro/server-mcp-auth": "^${version}",`,
    );
  } else {
    result = result.replace(/^.*__AUTH_DEP__.*\n/m, '');
  }

  if (options.oauth) {
    result = result.replace(
      '__OAUTH_DEP__',
      `    "@onivoro/server-mcp-oauth": "^${version}",`,
    );
  } else {
    result = result.replace(/^.*__OAUTH_DEP__.*\n/m, '');
  }

  return result;
}

export function composeAppModule(options: ScaffoldOptions): string {
  const imports: string[] = [];
  const registrations: string[] = [];

  imports.push(`import { Module } from '@nestjs/common';`);

  // Collect @onivoro/server-mcp imports
  const mcpImports: string[] = [];
  if (options.transport === 'http' || options.transport === 'both') {
    mcpImports.push('McpHttpModule');
  }
  if (options.transport === 'stdio' || options.transport === 'both') {
    mcpImports.push('McpStdioModule');
  }
  if (mcpImports.length > 0) {
    imports.push(`import { ${mcpImports.join(', ')} } from '@onivoro/server-mcp';`);
  }

  if (options.auth) {
    imports.push(`import { McpAuthModule, McpJwtAuthStrategy } from '@onivoro/server-mcp-auth';`);
  }

  if (options.oauth) {
    imports.push(`import { McpOAuthModule } from '@onivoro/server-mcp-oauth';`);
  }

  imports.push(`import { ExampleToolService } from './tools/example.tool';`);
  imports.push(`import { ExampleResourceService } from './resources/example.resource';`);
  imports.push(`import { ExamplePromptService } from './prompts/example.prompt';`);

  // Build module registrations
  if (options.auth) {
    registrations.push(`    McpAuthModule.register({
      jwksUri: process.env.JWKS_URI!,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    }),`);
  }

  if (options.oauth) {
    registrations.push(`    // TODO: Replace with your OAuthServerProvider implementation
    // McpOAuthModule.register({
    //   provider: MyOAuthProvider,
    //   issuerUrl: process.env.OAUTH_ISSUER_URL!,
    //   scopesSupported: ['read', 'write'],
    // }),`);
  }

  const authStrategyOption = options.auth
    ? `\n      authStrategy: McpJwtAuthStrategy,`
    : '';

  if (options.transport === 'http' || options.transport === 'both') {
    registrations.push(`    McpHttpModule.registerAndServeHttp({
      metadata: { name: '${options.projectName}', version: '0.0.1' },${authStrategyOption}
    }),`);
  }

  if (options.transport === 'stdio' || options.transport === 'both') {
    registrations.push(`    McpStdioModule.registerAndServeStdio({
      metadata: { name: '${options.projectName}', version: '0.0.1' },${authStrategyOption}
    }),`);
  }

  return `${imports.join('\n')}

@Module({
  imports: [
${registrations.join('\n')}
  ],
  providers: [ExampleToolService, ExampleResourceService, ExamplePromptService],
})
export class AppModule {}
`;
}

export async function generate(options: ScaffoldOptions, outputDir?: string): Promise<string> {
  const targetDir = outputDir ?? path.resolve(process.cwd(), options.projectName);
  const templatesDir = getTemplatesDir();
  const version = getLibVersion();

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`Directory "${targetDir}" already exists and is not empty.`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // Process template files
  const replacements: Record<string, string> = {
    __PROJECT_NAME__: options.projectName,
    __LIB_VERSION__: version,
  };

  // Copy and process .tmpl files from templates root
  processTemplateFile(
    path.join(templatesDir, 'tsconfig.json.tmpl'),
    path.join(targetDir, 'tsconfig.json'),
    replacements,
  );

  processTemplateFile(
    path.join(templatesDir, 'gitignore.tmpl'),
    path.join(targetDir, '.gitignore'),
    replacements,
  );

  // package.json needs special handling for conditional deps
  const pkgContent = fs.readFileSync(path.join(templatesDir, 'package.json.tmpl'), 'utf-8');
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    processPackageJson(pkgContent, options, version),
  );

  // .env.example only when auth is enabled
  if (options.auth) {
    processTemplateFile(
      path.join(templatesDir, 'env.example.tmpl'),
      path.join(targetDir, '.env.example'),
      replacements,
    );
  }

  // src directory
  fs.mkdirSync(path.join(targetDir, 'src', 'tools'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src', 'resources'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src', 'prompts'), { recursive: true });

  // main.ts — pick the right template
  const mainTemplate = options.transport === 'stdio'
    ? 'main.stdio.ts.tmpl'
    : 'main.http.ts.tmpl';
  processTemplateFile(
    path.join(templatesDir, 'src', mainTemplate),
    path.join(targetDir, 'src', 'main.ts'),
    replacements,
  );

  // app.module.ts — generated programmatically
  fs.writeFileSync(
    path.join(targetDir, 'src', 'app.module.ts'),
    composeAppModule(options),
  );

  // example tool
  processTemplateFile(
    path.join(templatesDir, 'src', 'tools', 'example.tool.ts.tmpl'),
    path.join(targetDir, 'src', 'tools', 'example.tool.ts'),
    replacements,
  );

  // example resource
  processTemplateFile(
    path.join(templatesDir, 'src', 'resources', 'example.resource.ts.tmpl'),
    path.join(targetDir, 'src', 'resources', 'example.resource.ts'),
    replacements,
  );

  // example prompt
  processTemplateFile(
    path.join(templatesDir, 'src', 'prompts', 'example.prompt.ts.tmpl'),
    path.join(targetDir, 'src', 'prompts', 'example.prompt.ts'),
    replacements,
  );

  // Print success
  console.log(`\nCreated ${options.projectName} in ${targetDir}\n`);
  console.log('Next steps:\n');
  console.log(`  cd ${options.projectName}`);
  console.log('  npm install');
  if (options.auth) {
    console.log('  cp .env.example .env  # configure your auth settings');
  }
  if (options.transport === 'stdio') {
    console.log('  npm run build');
    console.log('  # Add to your MCP client config as a stdio server');
  } else {
    console.log('  npm run start:dev');
    console.log('');
    console.log('Connect with Claude Code:\n');
    console.log(`  claude mcp add ${options.projectName} --transport http http://localhost:3000/mcp`);
  }
  console.log('');

  return targetDir;
}

function processTemplateFile(
  src: string,
  dest: string,
  replacements: Record<string, string>,
): void {
  const content = fs.readFileSync(src, 'utf-8');
  fs.writeFileSync(dest, applyReplacements(content, replacements));
}
