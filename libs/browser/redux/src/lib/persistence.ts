import { buildInitialState, getPersistedSlices, SliceConfig } from './slice-registry';

/**
 * Loads persisted state from localStorage and merges with initial state.
 */
export function loadPersistedState(sliceRegistry: SliceConfig[], storageKeyPrefix: string) {
  const STORAGE_KEY = buildStorageKey(storageKeyPrefix);
  const allSlices = buildInitialState(sliceRegistry);

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return allSlices;

    const parsed = JSON.parse(cached);
    const persistedSlices = getPersistedSlices(sliceRegistry);

    return {
      ...allSlices,
      ...Object.fromEntries(
        persistedSlices.map(({ slice }) => [
          slice.name,
          parsed[slice.name] ?? slice.getInitialState()
        ])
      )
    };
  } catch (err) {
    console.error('Error loading state:', err);
    return allSlices;
  }
}

export const buildStorageKey = (prefix: string) => `${prefix}-state-${location.host}`;

/**
 * Saves only the persisted slices to localStorage.
 */
export function savePersistedState(state: Record<string, unknown>, sliceRegistry: SliceConfig[], storageKeyPrefix: string) {
  const STORAGE_KEY = buildStorageKey(storageKeyPrefix);

  try {
    const persistedSlices = getPersistedSlices(sliceRegistry);
    const toSave = Object.fromEntries(
      persistedSlices.map(({ slice }) => [slice.name, state[slice.name]])
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.error('Error saving state:', err);
  }
}
