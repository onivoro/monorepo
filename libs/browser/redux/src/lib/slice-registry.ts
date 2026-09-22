import { Slice } from '@reduxjs/toolkit';

export type SliceConfig = {
  slice: Slice;
  /** Mark which slices should be persisted to localStorage. */
  persist?: boolean;
  /**
   * How long this slice's persisted copy stays usable, in milliseconds.
   * Overrides the default TTL passed to loadPersistedState. When neither is
   * set the slice never expires, which is what every caller got before TTLs
   * existed.
   */
  ttlMs?: number;
};

/**
 * Builds the reducer map for configureStore from the slice registry.
 * @returns Object mapping slice names to their reducers
 */
export function buildReducers(sliceRegistry: SliceConfig[]) {
  return Object.fromEntries(
    sliceRegistry.map(({ slice }) => [slice.name, slice.reducer]),
  );
}

/**
 * Builds the initial state object from all registered slices.
 * @returns Object mapping slice names to their initial states
 */
export function buildInitialState(sliceRegistry: SliceConfig[]) {
  return Object.fromEntries(
    sliceRegistry.map(({ slice }) => [slice.name, slice.getInitialState()]),
  );
}

/**
 * Gets only the slices marked for persistence.
 * @returns Array of slice configs that should be persisted
 */
export function getPersistedSlices(sliceRegistry: SliceConfig[]) {
  return sliceRegistry.filter(({ persist }) => persist);
}
