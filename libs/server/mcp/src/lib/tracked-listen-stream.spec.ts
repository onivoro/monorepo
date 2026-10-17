import {
  TrackedListenStream,
  frozenCopy,
  listenRequestId,
  splitSseEvents,
} from './tracked-listen-stream';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** The acknowledgement as the SDK writes it. */
const ACK =
  'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/subscriptions/acknowledged","params":{}}\n\n';
const UPDATE =
  'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/resources/updated","params":{"uri":"a://b"}}\n\n';
const GRACEFUL =
  'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"resultType":"complete","_meta":' +
  '{"io.modelcontextprotocol/subscriptionId":7,"io.modelcontextprotocol/serverInfo":{"name":"srv","version":"1"}}}}\n\n';

/** An SDK-like event-stream response whose bytes the test pushes, chunked as it likes. */
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
    push: (text: string) => {
      try {
        controller.enqueue(encoder.encode(text));
      } catch {
        // cancelled
      }
    },
    end: () => controller.close(),
  };
}

/** Reads everything the client would get, until the response ends. */
async function readAll(response: Response): Promise<string> {
  let text = '';
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    text += decoder.decode(chunk, { stream: true });
  }
  return text;
}

/** Reads until the client has got `expected` (or more). */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expected: string,
): Promise<string> {
  let text = '';
  while (text.length < expected.length) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  return text;
}

async function readRest(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value);
  }
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

/** Lets queued reads and writes settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('TrackedListenStream', () => {
  it('passes the stream through until it is closed, then sends the result and ends', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const reader = response.body!.getReader();

    sdk.push(ACK);
    sdk.push(UPDATE);
    expect(await readUntil(reader, ACK + UPDATE)).toBe(ACK + UPDATE);

    stream.close();
    sdk.push(UPDATE);

    expect(await readRest(reader)).toBe(GRACEFUL);
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

  it('waits for the acknowledgement event, not the first chunk: a priming event goes first', async () => {
    const { stream } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    const priming = 'id: 0\ndata:\n\n';

    stream.close();
    sdk.push(priming);
    await settle();
    sdk.push(ACK);

    await expect(readAll(response)).resolves.toBe(priming + ACK + GRACEFUL);
  });

  it('never closes inside an event, however the bytes are split', async () => {
    const { stream } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    const reader = response.body!.getReader();

    // The acknowledgement in three pieces, the update split mid-JSON.
    sdk.push(ACK.slice(0, 10));
    sdk.push(ACK.slice(10, 40));
    stream.close();
    sdk.push(ACK.slice(40) + UPDATE.slice(0, 30));

    // The client gets the whole acknowledgement and then the result; the half update the SDK
    // had written when the close happened is not sent.
    expect(await readRest(reader)).toBe(ACK + GRACEFUL);
  });

  it('holds back a half-written event until it is complete', async () => {
    const { stream } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    const reader = response.body!.getReader();

    sdk.push(ACK + UPDATE.slice(0, 25));
    expect(await readUntil(reader, ACK)).toBe(ACK);
    sdk.push(UPDATE.slice(25));
    expect(await readUntil(reader, UPDATE)).toBe(UPDATE);

    stream.close();
    expect(await readRest(reader)).toBe(GRACEFUL);
  });

  it('passes events coalesced into one chunk, and CRLF line endings, through whole', async () => {
    const { stream } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    const crlfUpdate = UPDATE.replace(/\n/g, '\r\n');

    stream.close();
    // A \r at the end of a chunk might be the first half of \r\n: it waits for the \n.
    sdk.push(ACK + crlfUpdate.slice(0, -1));
    await settle();
    sdk.push(crlfUpdate.slice(-1));

    await expect(readAll(response)).resolves.toBe(ACK + GRACEFUL);
  });

  it('reports a close asked for while opening, once', async () => {
    const { stream } = tracked();
    expect(stream.closeRequested).toBe(false);
    stream.close();
    stream.close();
    expect(stream.closeRequested).toBe(true);
    await expect(stream.whenCloseRequested).resolves.toBeUndefined();
  });

  it('finishes when the SDK ends the stream itself, passing an incomplete tail as written', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);

    sdk.push(ACK + 'data: half');
    sdk.end();

    await expect(readAll(response)).resolves.toBe(ACK + 'data: half');
    expect(onFinished).toHaveBeenCalledTimes(1);
    stream.close();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('finishes and cancels the SDK side when the client goes away', async () => {
    const { stream, onFinished } = tracked();
    const sdk = sdkResponse();
    const response = stream.wrap(sdk.response);
    sdk.push(ACK);
    const reader = response.body!.getReader();
    await readUntil(reader, ACK);

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

  it('holds a frozen copy of the auth, so the request auth cannot be changed through it', () => {
    const authInfo = {
      token: 't',
      clientId: 'c',
      scopes: ['a'],
      extra: { roles: ['x'], nested: { deep: 1 } },
    };
    const { info } = new TrackedListenStream(1, authInfo, {}, jest.fn());

    expect(info.authInfo).toEqual(authInfo);
    expect(info.authInfo).not.toBe(authInfo);
    expect(() => (info.authInfo!.scopes as string[]).push('b')).toThrow();
    expect(() => {
      (info.authInfo!.extra!['nested'] as { deep: number }).deep = 2;
    }).toThrow();
    expect(authInfo.extra.nested.deep).toBe(1);
    expect(Object.isFrozen(info)).toBe(true);
  });
});

describe('splitSseEvents', () => {
  it('splits whole events from the rest, for every line ending', () => {
    expect(splitSseEvents('a: 1\n\nb: 2\n')).toEqual({
      events: ['a: 1\n\n'],
      rest: 'b: 2\n',
    });
    expect(splitSseEvents('a\r\n\r\nb\r\rc')).toEqual({
      events: ['a\r\n\r\n', 'b\r\r'],
      rest: 'c',
    });
    expect(splitSseEvents(': keepalive\n\n')).toEqual({
      events: [': keepalive\n\n'],
      rest: '',
    });
  });

  it('waits on a trailing \\r, which may be half a \\r\\n', () => {
    expect(splitSseEvents('a\r\n\r')).toEqual({ events: [], rest: 'a\r\n\r' });
    expect(splitSseEvents('a\r\n\r\n')).toEqual({
      events: ['a\r\n\r\n'],
      rest: '',
    });
  });
});

describe('frozenCopy', () => {
  it('copies URLs and keeps other objects', () => {
    const url = new URL('https://a.example/x');
    const date = new Date(0);
    const copy = frozenCopy({ url, date });
    expect(copy.url).not.toBe(url);
    expect(copy.url.href).toBe(url.href);
    expect(copy.date).toBe(date);
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
