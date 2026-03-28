import type { Slice } from '@reduxjs/toolkit';

export type SliceConfig = {
  slice: Slice;
  persist?: boolean;
};

/**
 * Builds the reducer map for configureStore from the slice registry.
 */
export function buildReducers(sliceRegistry: SliceConfig[]) {
  return Object.fromEntries(
    sliceRegistry.map(({ slice }) => [slice.name, slice.reducer])
  );
}

/**
 * Builds the initial state object from all registered slices.
 */
export function buildInitialState(sliceRegistry: SliceConfig[]) {
  return Object.fromEntries(
    sliceRegistry.map(({ slice }) => [slice.name, slice.getInitialState()])
  );
}

/**
 * Gets only the slices marked for persistence.
 */
export function getPersistedSlices(sliceRegistry: SliceConfig[]) {
  return sliceRegistry.filter(({ persist }) => persist);
}
