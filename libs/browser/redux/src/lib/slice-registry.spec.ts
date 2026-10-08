import { configureStore, createSlice } from '@reduxjs/toolkit';
import {
  buildInitialState,
  buildReducers,
  getPersistedSlices,
  SliceConfig,
} from './slice-registry';

const counter = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment(state) {
      state.value += 1;
    },
  },
});

const flags = createSlice({
  name: 'flags',
  initialState: { on: false },
  reducers: {},
});

const prefs = createSlice({
  name: 'prefs',
  initialState: { theme: 'light' },
  reducers: {},
});

const registry: SliceConfig[] = [
  { slice: counter, persist: true, ttlMs: 1000 },
  { slice: flags },
  { slice: prefs, persist: false },
];

describe('buildReducers', () => {
  it('maps each slice name to its reducer', () => {
    expect(buildReducers(registry)).toEqual({
      counter: counter.reducer,
      flags: flags.reducer,
      prefs: prefs.reducer,
    });
  });

  it('produces a reducer map configureStore accepts', () => {
    const store = configureStore({ reducer: buildReducers(registry) });

    store.dispatch(counter.actions.increment());

    expect(store.getState()).toEqual({
      counter: { value: 1 },
      flags: { on: false },
      prefs: { theme: 'light' },
    });
  });

  it('returns an empty map for an empty registry', () => {
    expect(buildReducers([])).toEqual({});
  });
});

describe('buildInitialState', () => {
  it('maps each slice name to its initial state', () => {
    expect(buildInitialState(registry)).toEqual({
      counter: { value: 0 },
      flags: { on: false },
      prefs: { theme: 'light' },
    });
  });

  it('returns an empty object for an empty registry', () => {
    expect(buildInitialState([])).toEqual({});
  });
});

describe('getPersistedSlices', () => {
  it('keeps only slices with persist: true', () => {
    expect(getPersistedSlices(registry)).toEqual([registry[0]]);
  });

  it('returns an empty array when nothing persists', () => {
    expect(getPersistedSlices([{ slice: flags }])).toEqual([]);
  });
});
