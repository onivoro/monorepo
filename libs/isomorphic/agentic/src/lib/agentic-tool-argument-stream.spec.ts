import { AgenticToolArgumentStream } from './agentic-tool-argument-stream';

describe(AgenticToolArgumentStream.name, () => {
  it('accumulates streamed tool input and emits a parsed tool call', () => {
    const stream = new AgenticToolArgumentStream<number>();

    expect(stream.start(0, { id: 'call-1', name: 'lookup' }).events).toEqual([
      { type: 'tool-input-start', id: 'call-1', name: 'lookup' },
    ]);

    stream.appendExisting(0, '{"id":');
    stream.appendExisting(0, '"123"}');

    expect(stream.finish(0).events).toEqual([
      { type: 'tool-input-end', id: 'call-1', name: 'lookup' },
      {
        type: 'tool-call',
        id: 'call-1',
        name: 'lookup',
        input: { id: '123' },
      },
    ]);
  });
});
