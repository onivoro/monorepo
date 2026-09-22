import { createSlice } from '@reduxjs/toolkit';
import {
  buildStorageKey,
  loadPersistedState,
  PERSISTENCE_VERSION,
  savePersistedState,
} from './persistence';
import { SliceConfig } from './slice-registry';

const makeSlice = (name: string) =>
  createSlice({
    name,
    initialState: { value: 0 },
    reducers: {},
  });

const persisted = makeSlice('persisted');
const other = makeSlice('other');
const transient = makeSlice('transient');

const registry: SliceConfig[] = [
  { slice: persisted, persist: true },
  { slice: other, persist: true },
  { slice: transient },
];

// Each test needs its own prefix: the dirty check is keyed by storage key and
// deliberately outlives a single call, so sharing one would leak between them
let n = 0;
const nextPrefix = () => {
  n += 1;
  return `test-${n}`;
};

const readEnvelope = (prefix: string) =>
  JSON.parse(localStorage.getItem(buildStorageKey(prefix)) as string);

const seedEnvelope = (
  prefix: string,
  slices: Record<string, { savedAt: number; state: unknown }>,
  version = PERSISTENCE_VERSION,
) =>
  localStorage.setItem(
    buildStorageKey(prefix),
    JSON.stringify({ version, slices }),
  );

describe('savePersistedState', () => {
  let setItem: jest.SpyInstance;

  beforeEach(() => {
    localStorage.clear();
    setItem = jest.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    setItem.mockRestore();
  });

  it('writes the persisted slices and leaves the rest out', () => {
    const prefix = nextPrefix();
    const state = {
      persisted: { value: 1 },
      other: { value: 2 },
      transient: { value: 3 },
    };

    savePersistedState(state, registry, prefix);

    const written = readEnvelope(prefix);
    expect(Object.keys(written.slices)).toEqual(['persisted', 'other']);
    expect(written.slices.persisted.state).toEqual({ value: 1 });
    expect(written.slices.other.state).toEqual({ value: 2 });
  });

  it('does not write again when no persisted slice changed', () => {
    const prefix = nextPrefix();
    const state = {
      persisted: { value: 1 },
      other: { value: 2 },
      transient: { value: 3 },
    };

    savePersistedState(state, registry, prefix);
    savePersistedState(state, registry, prefix);
    savePersistedState(state, registry, prefix);

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  // the case this exists for: a websocket message or a toast dispatches, the
  // subscriber runs, and nothing it persists has changed
  it('does not write when only a transient slice changed', () => {
    const prefix = nextPrefix();
    const persistedValue = { value: 1 };
    const otherValue = { value: 2 };

    savePersistedState(
      { persisted: persistedValue, other: otherValue, transient: { value: 1 } },
      registry,
      prefix,
    );
    savePersistedState(
      { persisted: persistedValue, other: otherValue, transient: { value: 2 } },
      registry,
      prefix,
    );

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('writes again when a persisted slice changes', () => {
    const prefix = nextPrefix();
    const otherValue = { value: 2 };

    savePersistedState(
      { persisted: { value: 1 }, other: otherValue, transient: {} },
      registry,
      prefix,
    );
    savePersistedState(
      { persisted: { value: 9 }, other: otherValue, transient: {} },
      registry,
      prefix,
    );

    expect(setItem).toHaveBeenCalledTimes(2);
    expect(readEnvelope(prefix).slices.persisted.state).toEqual({ value: 9 });
  });

  it('tracks each storage key separately', () => {
    const one = nextPrefix();
    const two = nextPrefix();
    const state = {
      persisted: { value: 1 },
      other: { value: 2 },
      transient: {},
    };

    savePersistedState(state, registry, one);
    savePersistedState(state, registry, two);

    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('retries the next time when writing failed', () => {
    const prefix = nextPrefix();
    const state = {
      persisted: { value: 1 },
      other: { value: 2 },
      transient: {},
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    savePersistedState(state, registry, prefix);
    savePersistedState(state, registry, prefix);

    // the failed write must not be recorded as the last saved state, or an
    // unchanged store would never try again
    expect(setItem).toHaveBeenCalledTimes(2);
  });
});

describe('loadPersistedState', () => {
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const T0 = 1_700_000_000_000;

  // persisted carries its own TTL, other falls back to whatever the caller
  // passes as the default
  const ttlRegistry: SliceConfig[] = [
    { slice: persisted, persist: true, ttlMs: HOUR },
    { slice: other, persist: true },
    { slice: transient },
  ];

  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a slice that is still within its TTL', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - 30 * MINUTE, state: { value: 1 } },
      other: { savedAt: T0 - 30 * MINUTE, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });

    expect(loaded.persisted).toEqual({ value: 1 });
    expect(loaded.other).toEqual({ value: 2 });
    expect(loaded.transient).toEqual({ value: 0 });
  });

  it('drops a slice past its TTL back to its initial state', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - HOUR - 1, state: { value: 1 } },
      other: { savedAt: T0, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });

    expect(loaded.persisted).toEqual({ value: 0 });
    expect(loaded.other).toEqual({ value: 2 });
  });

  it('prefers the slice TTL over the default', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - 2 * HOUR, state: { value: 1 } },
      other: { savedAt: T0 - 2 * HOUR, state: { value: 2 } },
    });

    const loaded = loadPersistedState(ttlRegistry, prefix, {
      defaultTtlMs: 30 * DAY,
    });

    expect(loaded.persisted).toEqual({ value: 0 });
    expect(loaded.other).toEqual({ value: 2 });
  });

  // no TTL anywhere means the behaviour callers had before TTLs existed
  it('never expires when neither a slice TTL nor a default is set', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - 365 * DAY, state: { value: 1 } },
      other: { savedAt: T0 - 365 * DAY, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix);

    expect(loaded.persisted).toEqual({ value: 1 });
  });

  it('discards a payload written in another format', () => {
    const prefix = nextPrefix();
    // the flat, timestamp-less shape this replaced
    localStorage.setItem(
      buildStorageKey(prefix),
      JSON.stringify({ persisted: { value: 1 }, other: { value: 2 } }),
    );

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });

    expect(loaded.persisted).toEqual({ value: 0 });
    expect(loaded.other).toEqual({ value: 0 });
  });

  it('discards a payload written under a different version', () => {
    const prefix = nextPrefix();
    seedEnvelope(
      prefix,
      { persisted: { savedAt: T0, state: { value: 1 } } },
      PERSISTENCE_VERSION + 1,
    );

    expect(
      loadPersistedState(registry, prefix, { defaultTtlMs: HOUR }).persisted,
    ).toEqual({ value: 0 });
  });

  // a clock that moved backwards after the write must not make a cache
  // immortal, and neither must a timestamp that is missing or unparseable
  it.each([
    ['in the future', T0 + HOUR],
    ['missing', undefined],
    ['not a number', 'yesterday'],
  ])('treats a timestamp that is %s as expired', (_label, savedAt) => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt, state: { value: 1 } } as never,
    });

    expect(
      loadPersistedState(registry, prefix, { defaultTtlMs: HOUR }).persisted,
    ).toEqual({ value: 0 });
  });

  // the bug this guards: if the first write after a load restamped everything,
  // the TTL would decay into "time since the last page load"
  it('does not restamp slices that a load left untouched', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - 30 * MINUTE, state: { value: 1 } },
      other: { savedAt: T0 - 30 * MINUTE, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });

    jest.setSystemTime(T0 + 10 * MINUTE);
    savePersistedState({ ...loaded, other: { value: 99 } }, registry, prefix);

    const written = readEnvelope(prefix);
    expect(written.slices.persisted.savedAt).toBe(T0 - 30 * MINUTE);
    expect(written.slices.other.savedAt).toBe(T0 + 10 * MINUTE);
  });

  it('expires a slice that a busy neighbour kept rewriting', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0, state: { value: 1 } },
      other: { savedAt: T0, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });

    jest.setSystemTime(T0 + 59 * MINUTE);
    savePersistedState({ ...loaded, other: { value: 99 } }, registry, prefix);

    jest.setSystemTime(T0 + 61 * MINUTE);
    const reloaded = loadPersistedState(registry, prefix, {
      defaultTtlMs: HOUR,
    });

    expect(reloaded.persisted).toEqual({ value: 0 });
    expect(reloaded.other).toEqual({ value: 99 });
  });

  // an expired slice hydrates to its initial state, but storage still holds
  // the dead copy until something writes over it
  it('rewrites storage after a slice hydrated expired', () => {
    const prefix = nextPrefix();
    seedEnvelope(prefix, {
      persisted: { savedAt: T0 - 2 * HOUR, state: { value: 1 } },
      other: { savedAt: T0, state: { value: 2 } },
    });

    const loaded = loadPersistedState(registry, prefix, { defaultTtlMs: HOUR });
    savePersistedState(loaded, registry, prefix);

    const written = readEnvelope(prefix);
    expect(written.slices.persisted.state).toEqual({ value: 0 });
    expect(written.slices.persisted.savedAt).toBe(T0);
    expect(written.slices.other.savedAt).toBe(T0);
  });
});
