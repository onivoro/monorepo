import {
  buildInitialState,
  getPersistedSlices,
  SliceConfig,
} from './slice-registry';

/**
 * The shape written to localStorage. Bumping this discards everything already
 * stored: a payload written by another version has no age this one can trust,
 * and guessing at it is worse than a cold cache.
 *
 * That makes it the lever for clearing every user's persisted state on a given
 * release -- bump it when a persisted slice changes shape, or when stale data
 * needs to be off the field regardless of TTL. The cost is one cold load per
 * browser, plus any persisted state that nothing refetches.
 */
export const PERSISTENCE_VERSION = 1;

export type PersistenceOptions = {
  /** TTL applied to persisted slices that do not set their own `ttlMs`. */
  defaultTtlMs?: number;
};

type PersistedSlice = { savedAt: number; state: unknown };

type PersistedEnvelope = {
  version: number;
  slices: Record<string, PersistedSlice>;
};

/**
 * Whether a persisted slice is still within its TTL.
 *
 * No TTL configured means it never expires -- the behaviour every caller had
 * before TTLs existed. A timestamp that is missing, unparseable, or in the
 * future is treated as expired: a clock that moved backwards after the write
 * must not make a cache immortal.
 */
function isFresh(savedAt: unknown, ttlMs: number | undefined, now: number) {
  if (ttlMs === undefined) return true;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return false;
  if (savedAt > now) return false;

  return now - savedAt < ttlMs;
}

/**
 * Loads persisted state from localStorage and merges with initial state.
 * Only slices marked with persist: true in the registry are loaded from
 * storage, and only while they are within their TTL -- an expired slice
 * hydrates to its initial state, which is what makes the app refetch it.
 * @returns Complete state object with persisted values merged in
 */
export function loadPersistedState(
  sliceRegistry: SliceConfig[],
  storageKeyPrefix: string,
  options?: PersistenceOptions,
) {
  const STORAGE_KEY = buildStorageKey(storageKeyPrefix);
  const allSlices = buildInitialState(sliceRegistry);

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return allSlices;

    const parsed: PersistedEnvelope = JSON.parse(cached);
    if (parsed?.version !== PERSISTENCE_VERSION || !parsed.slices) {
      return allSlices;
    }

    const now = Date.now();
    const persistedSlices = getPersistedSlices(sliceRegistry);
    const hydrated: Record<string, unknown> = {};
    const savedAt: Record<string, number> = {};

    persistedSlices.forEach(({ slice, ttlMs }) => {
      const entry = parsed.slices[slice.name];

      if (
        !entry ||
        !isFresh(entry.savedAt, ttlMs ?? options?.defaultTtlMs, now)
      ) {
        hydrated[slice.name] = slice.getInitialState();
        return;
      }

      hydrated[slice.name] = entry.state ?? slice.getInitialState();
      savedAt[slice.name] = entry.savedAt;
    });

    // Seed the save side with what was just hydrated, timestamps included.
    // Without this the first write after any page load would restamp every
    // slice, and the TTL would decay into "time since the last page load".
    // The references survive the trip: configureStore hands preloadedState to
    // the reducers untouched, so they are the objects the store now holds.
    lastWritten.set(STORAGE_KEY, { slices: hydrated, savedAt });

    return { ...allSlices, ...hydrated };
  } catch (err) {
    console.error('Error loading state:', err);
    return allSlices;
  }
}

export const buildStorageKey = (prefix: string) =>
  `${prefix}-state-${location.host}`;

/**
 * The persisted slices as they were last written, and when, per storage key.
 *
 * This is called from a store subscriber, so it runs on every dispatch --
 * every websocket message, every toast, every loading flag, none of which
 * touch a persisted slice. Without this it serialised and wrote the whole
 * persisted set each time, and those sets are not small: an app that persists
 * reference data can hold thousands of rows in a single slice.
 *
 * It holds slice references, so it keeps one superseded generation of the
 * persisted slices alive per storage key. That is the price of comparing by
 * reference: storing a hash instead would mean serialising on every dispatch,
 * which is the work this exists to avoid. There is one key per app, entries are
 * never orphaned, and the retained objects are the ones redux held a moment ago
 * -- so the bound is a single extra copy, not growth.
 */
const lastWritten = new Map<
  string,
  { slices: Record<string, unknown>; savedAt: Record<string, number> }
>();

/**
 * Saves only the persisted slices to localStorage.
 * Non-persisted slices are excluded from storage.
 * @param state - The full Redux state
 */
export function savePersistedState(
  state: Record<string, unknown>,
  sliceRegistry: SliceConfig[],
  storageKeyPrefix: string,
) {
  const STORAGE_KEY = buildStorageKey(storageKeyPrefix);

  try {
    const persistedSlices = getPersistedSlices(sliceRegistry);
    const toSave = Object.fromEntries(
      persistedSlices.map(({ slice }) => [slice.name, state[slice.name]]),
    );

    // Reference comparison is sound here because reducers never mutate: a
    // slice that did not change is the same object it was last time, and it
    // keeps the timestamp it was written with. Only the slices that actually
    // changed are aged from now -- restamping all of them on every write would
    // let a single busy slice (a route-history slice changes on every
    // navigation) hold the caches beside it alive indefinitely.
    //
    // Undefined means nothing to carry over: the slice changed, or it hydrated
    // expired and storage still holds the dead copy to evict. Either way the
    // write goes ahead.
    const lastSaved = lastWritten.get(STORAGE_KEY);
    const carryOver = ({ slice }: SliceConfig) => {
      const previous = lastSaved?.savedAt[slice.name];
      const sameSlice = lastSaved?.slices[slice.name] === toSave[slice.name];

      return sameSlice && typeof previous === 'number' ? previous : undefined;
    };

    const unchanged = persistedSlices.every(
      (config) => carryOver(config) !== undefined,
    );

    if (lastSaved && unchanged) {
      return;
    }

    const now = Date.now();
    const savedAt = Object.fromEntries(
      persistedSlices.map((config) => [
        config.slice.name,
        carryOver(config) ?? now,
      ]),
    );

    const envelope: PersistedEnvelope = {
      version: PERSISTENCE_VERSION,
      slices: Object.fromEntries(
        persistedSlices.map(({ slice }) => [
          slice.name,
          { savedAt: savedAt[slice.name], state: toSave[slice.name] },
        ]),
      ),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    lastWritten.set(STORAGE_KEY, { slices: toSave, savedAt });
  } catch (err) {
    console.error('Error saving state:', err);
  }
}
