import { configureStore } from '@reduxjs/toolkit';
import { createEntitySlice } from './create-entity-slice';

type Account = { id: number; name: string };

const a1: Account = { id: 1, name: 'one' };
const a2: Account = { id: 2, name: 'two' };
const a3: Account = { id: 3, name: 'three' };

const setup = () => {
  const slice = createEntitySlice<Account>('accountEntity');
  const store = configureStore({
    reducer: { accountEntity: slice.reducer },
  });
  return { slice, store, state: () => store.getState() };
};

describe('createEntitySlice', () => {
  it('names the slice and starts empty and unfocused', () => {
    const { slice, state } = setup();

    expect(slice.name).toBe('accountEntity');
    expect(slice.getInitialState()).toEqual({
      ids: [],
      entities: {},
      focused: {},
      focusedId: undefined,
    });
    expect(slice.selectors.ids(state())).toEqual([]);
    expect(slice.selectors.entities(state())).toEqual({});
    expect(slice.selectors.focusedId(state())).toBeUndefined();
    expect(slice.selectors.focused(state())).toBeUndefined();
  });

  it('addOne adds an entity and does not replace an existing one', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.addOne(a1));
    store.dispatch(slice.actions.addOne({ id: 1, name: 'changed' }));

    expect(slice.selectors.ids(state())).toEqual([1]);
    expect(slice.selectors.entities(state())).toEqual({ 1: a1 });
  });

  it('setOne inserts or replaces an entity', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setOne(a1));
    store.dispatch(slice.actions.setOne({ id: 1, name: 'changed' }));
    store.dispatch(slice.actions.setOne(a2));

    expect(slice.selectors.ids(state())).toEqual([1, 2]);
    expect(slice.selectors.entities(state())[1]).toEqual({
      id: 1,
      name: 'changed',
    });
  });

  it('setAll replaces every entity', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setAll([a1, a2]));
    store.dispatch(slice.actions.setAll([a3]));

    expect(slice.selectors.ids(state())).toEqual([3]);
    expect(slice.selectors.entities(state())).toEqual({ 3: a3 });
  });

  it('removeOne removes by id and ignores unknown ids', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setAll([a1, a2]));
    store.dispatch(slice.actions.removeOne(1));
    store.dispatch(slice.actions.removeOne(99));

    expect(slice.selectors.ids(state())).toEqual([2]);
  });

  it('removeAll empties the collection', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setAll([a1, a2]));
    store.dispatch(slice.actions.removeAll());

    expect(slice.selectors.ids(state())).toEqual([]);
    expect(slice.selectors.entities(state())).toEqual({});
  });

  it('focusOne sets the focused id and the focused selector resolves it', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setAll([a1, a2]));
    store.dispatch(slice.actions.focusOne({ id: 2 }));

    expect(slice.selectors.focusedId(state())).toBe(2);
    expect(slice.selectors.focused(state())).toEqual(a2);
  });

  it('focused is undefined when the focused id is not loaded', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.focusOne({ id: 42 }));

    expect(slice.selectors.focusedId(state())).toBe(42);
    expect(slice.selectors.focused(state())).toBeUndefined();
  });

  it('focusOne with no payload clears the focus', () => {
    const { slice, store, state } = setup();

    store.dispatch(slice.actions.setAll([a1]));
    store.dispatch(slice.actions.focusOne({ id: 1 }));
    store.dispatch(
      slice.actions.focusOne(undefined as unknown as { id: number }),
    );

    expect(slice.selectors.focusedId(state())).toBeUndefined();
    expect(slice.selectors.focused(state())).toBeUndefined();
  });

  it('focused resolves an entity whose id is 0', () => {
    const { slice, store, state } = setup();
    store.dispatch(slice.actions.setAll([{ id: 0, name: 'zero' }]));
    store.dispatch(slice.actions.focusOne({ id: 0 }));
    expect(slice.selectors.focused(state())).toEqual({ id: 0, name: 'zero' });
  });

  it('selectors fall back to empty values when the slice is not mounted', () => {
    const { slice } = setup();

    expect(slice.selectors.entities({})).toEqual({});
    expect(slice.selectors.ids({})).toEqual([]);
    expect(slice.selectors.focusedId({})).toBeUndefined();
    expect(slice.selectors.focused({})).toBeUndefined();
  });

  it('works with string ids', () => {
    const slice = createEntitySlice<{ id: string; v: number }>('things');
    const store = configureStore({ reducer: { things: slice.reducer } });

    store.dispatch(slice.actions.setAll([{ id: 'a', v: 1 }]));

    expect(slice.selectors.ids(store.getState())).toEqual(['a']);
    expect(slice.selectors.entities(store.getState())).toEqual({
      a: { id: 'a', v: 1 },
    });
  });

  it('focuses and selects entities by string id, including the empty string', () => {
    const slice = createEntitySlice<{ id: string; v: number }>('things');
    const store = configureStore({ reducer: { things: slice.reducer } });

    store.dispatch(
      slice.actions.setAll([
        { id: 'a', v: 1 },
        { id: '', v: 2 },
      ]),
    );
    store.dispatch(slice.actions.focusOne({ id: 'a' }));
    expect(slice.selectors.focusedId(store.getState())).toBe('a');
    expect(slice.selectors.focused(store.getState())).toEqual({
      id: 'a',
      v: 1,
    });

    store.dispatch(slice.actions.focusOne({ id: '' }));
    expect(slice.selectors.focused(store.getState())).toEqual({ id: '', v: 2 });
  });

  it('creates independent slices per call', () => {
    const one = createEntitySlice<Account>('one');
    const two = createEntitySlice<Account>('two');
    const store = configureStore({
      reducer: { one: one.reducer, two: two.reducer },
    });

    store.dispatch(one.actions.addOne(a1));

    expect(one.actions.addOne.type).toBe('one/addOne');
    expect(two.actions.addOne.type).toBe('two/addOne');
    expect(one.selectors.ids(store.getState())).toEqual([1]);
    expect(two.selectors.ids(store.getState())).toEqual([]);
  });
});
