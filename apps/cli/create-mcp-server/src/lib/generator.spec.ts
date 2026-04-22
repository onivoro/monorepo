import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generate, applyReplacements, processPackageJson, composeAppModule } from './generator';
import type { ScaffoldOptions } from './types';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'create-mcp-'));
}

function readGenerated(dir: string, ...segments: string[]): string {
  return fs.readFileSync(path.join(dir, ...segments), 'utf-8');
}

describe('applyReplacements', () => {
  it('should replace all occurrences of each token', () => {
    const result = applyReplacements('__A__ and __A__ and __B__', {
      __A__: 'x',
      __B__: 'y',
    });
    expect(result).toBe('x and x and y');
  });

  it('should return unchanged content when no tokens match', () => {
    expect(applyReplacements('no tokens here', { __X__: 'y' })).toBe('no tokens here');
  });
});

describe('processPackageJson', () => {
  const template = [
    '{',
    '  "name": "__PROJECT_NAME__",',
    '  "dependencies": {',
    '    "@onivoro/server-mcp": "^__LIB_VERSION__",',
    '__AUTH_DEP__',
    '__OAUTH_DEP__',
    '    "zod": "^4.0.0"',
    '  }',
    '}',
  ].join('\n');

  it('should include auth dep when auth=true', () => {
    const result = processPackageJson(template, {
      projectName: 'test',
      transport: 'http',
      auth: true,
      oauth: false,
    }, '1.0.0');
    expect(result).toContain('"@onivoro/server-mcp-auth": "^1.0.0"');
    expect(result).not.toContain('__AUTH_DEP__');
    expect(result).not.toContain('__OAUTH_DEP__');
  });

  it('should include both deps when oauth=true', () => {
    const result = processPackageJson(template, {
      projectName: 'test',
      transport: 'http',
      auth: true,
      oauth: true,
    }, '2.0.0');
    expect(result).toContain('"@onivoro/server-mcp-auth": "^2.0.0"');
    expect(result).toContain('"@onivoro/server-mcp-oauth": "^2.0.0"');
  });

  it('should strip dep lines when auth=false', () => {
    const result = processPackageJson(template, {
      projectName: 'test',
      transport: 'http',
      auth: false,
      oauth: false,
    }, '1.0.0');
    expect(result).not.toContain('server-mcp-auth');
    expect(result).not.toContain('server-mcp-oauth');
    expect(result).not.toContain('__AUTH_DEP__');
    expect(result).not.toContain('__OAUTH_DEP__');
  });
});

describe('composeAppModule', () => {
  it('should include McpHttpModule for http transport', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'http',
      auth: false,
      oauth: false,
    });
    expect(result).toContain('McpHttpModule');
    expect(result).not.toContain('McpStdioModule');
    expect(result).toContain('ExampleToolService');
    expect(result).toContain('ExampleResourceService');
    expect(result).toContain('ExamplePromptService');
  });

  it('should include McpStdioModule for stdio transport', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'stdio',
      auth: false,
      oauth: false,
    });
    expect(result).toContain('McpStdioModule');
    expect(result).not.toContain('McpHttpModule');
  });

  it('should include both modules for both transport', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'both',
      auth: false,
      oauth: false,
    });
    expect(result).toContain('McpHttpModule');
    expect(result).toContain('McpStdioModule');
  });

  it('should include auth imports and registration when auth=true', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'http',
      auth: true,
      oauth: false,
    });
    expect(result).toContain('McpAuthModule');
    expect(result).toContain('McpJwtAuthProvider');
    expect(result).toContain('authProvider: McpJwtAuthProvider');
    expect(result).toContain('process.env.JWKS_URI');
  });

  it('should not include auth when auth=false', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'http',
      auth: false,
      oauth: false,
    });
    expect(result).not.toContain('McpAuthModule');
    expect(result).not.toContain('McpJwtAuthProvider');
    expect(result).not.toContain('authProvider');
  });

  it('should include oauth placeholder when oauth=true', () => {
    const result = composeAppModule({
      projectName: 'test',
      transport: 'http',
      auth: true,
      oauth: true,
    });
    expect(result).toContain('McpOAuthModule');
  });

  it('should embed project name in metadata', () => {
    const result = composeAppModule({
      projectName: 'my-cool-server',
      transport: 'http',
      auth: false,
      oauth: false,
    });
    expect(result).toContain("name: 'my-cool-server'");
  });
});

describe('generate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const baseOptions: ScaffoldOptions = {
    projectName: 'test-server',
    transport: 'http',
    auth: false,
    oauth: false,
  };

  it('should create project directory with expected files', async () => {
    const outDir = path.join(tmpDir, 'test-server');
    await generate(baseOptions, outDir);

    expect(fs.existsSync(path.join(outDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, '.gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src', 'main.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src', 'app.module.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src', 'tools', 'example.tool.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src', 'resources', 'example.resource.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'src', 'prompts', 'example.prompt.ts'))).toBe(true);
  });

  it('should not create .env.example when auth=false', async () => {
    const outDir = path.join(tmpDir, 'no-auth');
    await generate(baseOptions, outDir);
    expect(fs.existsSync(path.join(outDir, '.env.example'))).toBe(false);
  });

  it('should create .env.example when auth=true', async () => {
    const outDir = path.join(tmpDir, 'with-auth');
    await generate({ ...baseOptions, auth: true }, outDir);
    expect(fs.existsSync(path.join(outDir, '.env.example'))).toBe(true);
    expect(readGenerated(outDir, '.env.example')).toContain('JWKS_URI');
  });

  it('should replace __PROJECT_NAME__ in generated files', async () => {
    const outDir = path.join(tmpDir, 'named');
    await generate({ ...baseOptions, projectName: 'cool-server' }, outDir);

    const pkg = JSON.parse(readGenerated(outDir, 'package.json'));
    expect(pkg.name).toBe('cool-server');

    const main = readGenerated(outDir, 'src', 'main.ts');
    expect(main).toContain('cool-server');
    expect(main).not.toContain('__PROJECT_NAME__');
  });

  it('should use http main.ts for http transport', async () => {
    const outDir = path.join(tmpDir, 'http');
    await generate({ ...baseOptions, transport: 'http' }, outDir);
    const main = readGenerated(outDir, 'src', 'main.ts');
    expect(main).toContain('NestFactory.create');
    expect(main).toContain('enableCors');
    expect(main).toContain('listen');
  });

  it('should use stdio main.ts for stdio transport', async () => {
    const outDir = path.join(tmpDir, 'stdio');
    await generate({ ...baseOptions, transport: 'stdio' }, outDir);
    const main = readGenerated(outDir, 'src', 'main.ts');
    expect(main).toContain('createApplicationContext');
    expect(main).not.toContain('enableCors');
  });

  it('should use http main.ts for both transport', async () => {
    const outDir = path.join(tmpDir, 'both');
    await generate({ ...baseOptions, transport: 'both' }, outDir);
    const main = readGenerated(outDir, 'src', 'main.ts');
    expect(main).toContain('NestFactory.create');
  });

  it('should include auth dep in package.json when auth=true', async () => {
    const outDir = path.join(tmpDir, 'auth-pkg');
    await generate({ ...baseOptions, auth: true }, outDir);
    const pkg = JSON.parse(readGenerated(outDir, 'package.json'));
    expect(pkg.dependencies['@onivoro/server-mcp-auth']).toBeDefined();
  });

  it('should include oauth dep in package.json when oauth=true', async () => {
    const outDir = path.join(tmpDir, 'oauth-pkg');
    await generate({ ...baseOptions, auth: true, oauth: true }, outDir);
    const pkg = JSON.parse(readGenerated(outDir, 'package.json'));
    expect(pkg.dependencies['@onivoro/server-mcp-auth']).toBeDefined();
    expect(pkg.dependencies['@onivoro/server-mcp-oauth']).toBeDefined();
  });

  it('should not include auth/oauth deps when not selected', async () => {
    const outDir = path.join(tmpDir, 'no-deps');
    await generate(baseOptions, outDir);
    const pkg = JSON.parse(readGenerated(outDir, 'package.json'));
    expect(pkg.dependencies['@onivoro/server-mcp-auth']).toBeUndefined();
    expect(pkg.dependencies['@onivoro/server-mcp-oauth']).toBeUndefined();
  });

  it('should have no remaining placeholder tokens in generated files', async () => {
    const outDir = path.join(tmpDir, 'clean');
    await generate({ ...baseOptions, auth: true, oauth: true }, outDir);

    const files = [
      'package.json',
      'tsconfig.json',
      '.gitignore',
      '.env.example',
      'src/main.ts',
      'src/app.module.ts',
      'src/tools/example.tool.ts',
      'src/resources/example.resource.ts',
      'src/prompts/example.prompt.ts',
    ];

    for (const file of files) {
      const content = readGenerated(outDir, ...file.split('/'));
      expect(content).not.toMatch(/__[A-Z_]+__/);
    }
  });

  it('should throw when target directory is not empty', async () => {
    const outDir = path.join(tmpDir, 'existing');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'file.txt'), 'existing');

    await expect(generate(baseOptions, outDir)).rejects.toThrow('already exists and is not empty');
  });

  it('should include McpHttpModule in app.module for http transport', async () => {
    const outDir = path.join(tmpDir, 'http-mod');
    await generate({ ...baseOptions, transport: 'http' }, outDir);
    const mod = readGenerated(outDir, 'src', 'app.module.ts');
    expect(mod).toContain('McpHttpModule');
    expect(mod).not.toContain('McpStdioModule');
  });

  it('should include both modules in app.module for both transport', async () => {
    const outDir = path.join(tmpDir, 'both-mod');
    await generate({ ...baseOptions, transport: 'both' }, outDir);
    const mod = readGenerated(outDir, 'src', 'app.module.ts');
    expect(mod).toContain('McpHttpModule');
    expect(mod).toContain('McpStdioModule');
  });
});
