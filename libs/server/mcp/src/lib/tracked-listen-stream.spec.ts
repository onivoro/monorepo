import { TrackedListenStream, listenRequestId } from './tracked-listen-stream';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const ACK = 'event: message\ndata: {"method":"ack"}\n\n';

/** An SDK-like event-stream response whose frames the test pushes. */
function sdkResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancelled = jest.fn();
  const body = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
    },
    cancel: cancelled,
  });
  const response = new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
  return {
    response,
    cancelled,
    // As the SDK's writeFrame does, writing to a cancelled stream does nothing.
    push: (frame: string) => {
      try {
        controller.enqueue(encoder.encode(frame));
      } catch {
        // cancelled
      }
    },
  };
}

async function readAll(response: Response): Promise<string> {
  let text = '';
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    text += decoder.decode(chunk);
  }
  return text;
}

async function readFrames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
): Promise<string> {
  let text = '';
  for (let i = 0; i < count; i++) {
    const { value } = await reader.read();
    text += decoder.decode(value);
  }
  return text;
}

function tracked(onFinished = jest.fn()) {
  const stream = new TrackedListenStream(
    7,
    { token: 't', clientId: 'c', scopes: [] },
    { name: 'srv', version: '1' },
    onFinished,
  );
  return { stream, onFinished };
}

const GRACEFUL =
  'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"resultType":"complete","_meta":' +
  '{"io.modelcontextprotocol/subscriptionId":7,"io.modelcontextprotocol/serverInfo":{"name":"srv","version":"1"}}}}\n\n';

describe('TrackedListenStream', () => {
  it('passes the stream through until it is closed, then sends the result and ends', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const reader = response.body!.getReader();

    sdk.push(ACK);
    sdk.push('event: message\ndata: {"method":"update"}\n\n');
    expect(await readFrames(reader, 2)).toBe(
      ACK + 'event: message\ndata: {"method":"update"}\n\n',
    );

    stream.close();
    sdk.push('event: message\ndata: {"method":"late"}\n\n');

    let rest = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += decoder.decode(value);
    }
    expect(rest).toBe(GRACEFUL);
    expect(sdk.cancelled).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('closes right after the acknowledgement when asked to close before it', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);

    stream.close();
    expect(onFinished).not.toHaveBeenCalled();
    sdk.push(ACK);

    await expect(readAll(response)).resolves.toBe(ACK + GRACEFUL);
    expect(sdk.cancelled).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('reports a close asked for while opening', () => {
    const { stream } = tracked();
    expect(stream.closeRequested).toBe(false);
    stream.close();
    expect(stream.closeRequested).toBe(true);
  });

  it('finishes when the SDK ends the stream itself', async () => {
    const { stream, onFinished } = tracked();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
        c.enqueue(encoder.encode(ACK));
      },
    });
    const response = stream.wrap(new Response(body));
    controller.close();

    await expect(readAll(response)).resolves.toBe(ACK);
    expect(onFinished).toHaveBeenCalledTimes(1);
    // Closing it afterwards does nothing.
    stream.close();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('finishes and cancels the SDK side when the client goes away', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    sdk.push(ACK);
    const reader = response.body!.getReader();
    await readFrames(reader, 1);

    await reader.cancel();

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(sdk.cancelled).toHaveBeenCalled();
  });

  it('finishes once when abandoned', () => {
    const { stream, onFinished } = tracked();
    stream.abandon();
    stream.abandon();
    stream.close();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});

describe('listenRequestId', () => {
  it('is the id of a subscriptions/listen request', () => {
    expect(
      listenRequestId({
        jsonrpc: '2.0',
        id: 3,
        method: 'subscriptions/listen',
      }),
    ).toBe(3);
    expect(
      listenRequestId({
        jsonrpc: '2.0',
        id: 'a',
        method: 'subscriptions/listen',
      }),
    ).toBe('a');
  });

  it('is undefined for anything else', () => {
    expect(listenRequestId(undefined)).toBeUndefined();
    expect(
      listenRequestId([{ id: 1, method: 'subscriptions/listen' }]),
    ).toBeUndefined();
    expect(listenRequestId({ id: 1, method: 'tools/list' })).toBeUndefined();
    expect(listenRequestId({ method: 'subscriptions/listen' })).toBeUndefined();
    expect(
      listenRequestId({ id: null, method: 'subscriptions/listen' }),
    ).toBeUndefined();
  });
});
