import { CommandHandler } from './command-handler';
import { CommandRegistry } from './command-registry';

const registerCommand = jest.fn();
jest.mock(
  'vscode',
  () => ({
    commands: { registerCommand: (...a: unknown[]) => registerCommand(...a) },
  }),
  { virtual: true },
);

class Commands {
  readonly prefix = 'hi';

  @CommandHandler('ext.greet')
  greet(name: string) {
    return `${this.prefix} ${name}`;
  }

  @CommandHandler('ext.other')
  async other() {
    return 42;
  }

  plain() {
    return 'not a command';
  }
}

describe(CommandRegistry.name, () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    registerCommand.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('discovers only decorated methods and binds them to the instance', () => {
    registry.addProvider(new Commands());

    expect(registry.getCommandIds()).toEqual(['ext.greet', 'ext.other']);
    const greet = registry.getHandlers()[0];
    expect(greet.handler('bob')).toBe('hi bob');
  });

  it('ignores null, non-objects and prototype-less objects', () => {
    registry.addProvider(null as unknown as object);
    registry.addProvider('str' as unknown as object);
    registry.addProvider(Object.create(null));
    registry.addProvider({});
    expect(registry.getHandlers()).toEqual([]);
  });

  it('skips decorated prototype methods shadowed by a non-function own property', () => {
    const instance = new Commands();
    Object.defineProperty(instance, 'greet', { value: 'shadowed' });
    registry.addProvider(instance);
    expect(registry.getCommandIds()).toEqual(['ext.other']);
  });

  it('returns a copy of the handlers', () => {
    registry.addProvider(new Commands());
    registry.getHandlers().pop();
    expect(registry.getHandlers()).toHaveLength(2);
  });

  it('registers every handler with vscode and returns disposables', () => {
    registry.addProvider(new Commands());
    registerCommand.mockImplementation((id: string) => ({ id }));

    const disposables = registry.registerAll({} as never);

    expect(registerCommand).toHaveBeenCalledTimes(2);
    expect(registerCommand.mock.calls.map((c) => c[0])).toEqual([
      'ext.greet',
      'ext.other',
    ]);
    expect(disposables).toEqual([{ id: 'ext.greet' }, { id: 'ext.other' }]);
  });

  it('pushes disposables onto the context subscriptions', () => {
    registry.addProvider(new Commands());
    registerCommand.mockImplementation((id: string) => ({ id }));
    const context = { subscriptions: [] as unknown[] };

    registry.registerAllToContext(context as never);

    expect(context.subscriptions).toEqual([
      { id: 'ext.greet' },
      { id: 'ext.other' },
    ]);
  });

  it('clear removes all handlers', () => {
    registry.addProvider(new Commands());
    registry.clear();
    expect(registry.getCommandIds()).toEqual([]);
  });
});
