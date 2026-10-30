import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { McpProtectedResourceController } from './mcp-protected-resource.controller';
import { McpScopeRegistry } from './mcp-scope-registry';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';

/**
 * Apps that serve this controller also publish an OpenAPI document, and
 * client generators reject a path whose `{resourcePath}` has no matching
 * parameter. Swagger describes a parameter from its emitted design type, so
 * this builds the document the way an app would.
 */
describe('McpProtectedResourceController OpenAPI document', () => {
  async function buildDocument() {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpProtectedResourceController],
      providers: [
        {
          provide: MCP_AUTH_CONFIG,
          useValue: {
            jwksUri: 'https://example.com/jwks',
            resourceServerUrl: 'https://api.example.com/mcp',
          },
        },
        { provide: McpScopeRegistry, useValue: { getScopesArray: () => [] } },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    await app.close();

    return document;
  }

  it('declares the resourcePath path parameter its path template names', async () => {
    const document = await buildDocument();
    const [path, item] =
      Object.entries(document.paths).find(([p]) =>
        p.startsWith('/.well-known/oauth-protected-resource/'),
      ) ?? [];

    expect(path).toBe('/.well-known/oauth-protected-resource/{resourcePath}');
    expect(item?.get?.parameters).toContainEqual(
      expect.objectContaining({
        name: 'resourcePath',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }),
    );
  });
});
