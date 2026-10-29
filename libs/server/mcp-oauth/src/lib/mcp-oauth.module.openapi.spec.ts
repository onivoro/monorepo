import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { McpOAuthModule } from './mcp-oauth.module';

/**
 * Apps that serve this module also publish an OpenAPI document, and client
 * generators reject a path whose `{resourcePath}` has no matching parameter.
 * Swagger only describes a parameter a handler declares, so this builds the
 * document the way an app would.
 */
describe('McpOAuthModule OpenAPI document', () => {
  async function buildDocument() {
    const moduleRef = await Test.createTestingModule({
      imports: [
        McpOAuthModule.configure({
          provider: {
            clientsStore: { getClient: jest.fn() },
            authorize: jest.fn(),
            challengeForAuthorizationCode: jest.fn(),
            exchangeAuthorizationCode: jest.fn(),
            exchangeRefreshToken: jest.fn(),
            verifyAccessToken: jest.fn(),
          } as any,
          issuerUrl: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    await app.close();

    return document;
  }

  it.each(['get', 'options'] as const)(
    'declares the resourcePath path parameter on %s',
    async (method) => {
      const document = await buildDocument();
      const item =
        document.paths['/.well-known/oauth-protected-resource/{resourcePath}'];

      expect(item?.[method]?.parameters).toContainEqual(
        expect.objectContaining({
          name: 'resourcePath',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        }),
      );
    },
  );
});
