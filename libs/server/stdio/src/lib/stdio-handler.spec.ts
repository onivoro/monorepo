import 'reflect-metadata';
import { STDIO_HANDLER_METADATA, StdioHandler } from './stdio-handler';

describe('StdioHandler', () => {
  it('stores the method name as metadata on the decorated method', () => {
    class Handlers {
      @StdioHandler('user.get')
      getUser() {
        return null;
      }

      undecorated() {
        return null;
      }
    }

    expect(
      Reflect.getMetadata(STDIO_HANDLER_METADATA, Handlers.prototype.getUser),
    ).toEqual({ method: 'user.get' });
    expect(
      Reflect.getMetadata(
        STDIO_HANDLER_METADATA,
        Handlers.prototype.undecorated,
      ),
    ).toBeUndefined();
  });
});
