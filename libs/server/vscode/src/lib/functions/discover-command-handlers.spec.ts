import { CommandHandler } from '../command-handler';
import { discoverCommandHandlers } from './discover-command-handlers';

class A {
  @CommandHandler('ext.a')
  a() {
    return 'a';
  }
}

class B {
  @CommandHandler('ext.b')
  b() {
    return 'b';
  }
}

describe(discoverCommandHandlers.name, () => {
  it('builds a registry from every provider', () => {
    const registry = discoverCommandHandlers([new A(), new B()]);
    expect(registry.getCommandIds()).toEqual(['ext.a', 'ext.b']);
  });

  it('returns an empty registry for no providers', () => {
    expect(discoverCommandHandlers([]).getHandlers()).toEqual([]);
  });
});
