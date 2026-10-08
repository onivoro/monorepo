# @onivoro/browser-redux

Redux Toolkit utilities: a slice registry for building the store, localStorage persistence with per-slice TTLs, and a factory for entity slices with CRUD reducers and focus tracking.

## Installation

```bash
npm install @onivoro/browser-redux @reduxjs/toolkit
```

`@reduxjs/toolkit` is a peer dependency. `createEntitySlice` uses the two-parameter `EntityState<T, Id>` type, which requires Redux Toolkit 2.

## Slice registry

Declare the store's slices once, marking which ones survive a reload:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { buildReducers, SliceConfig } from '@onivoro/browser-redux';

const HOUR = 60 * 60 * 1000;

export const sliceRegistry: SliceConfig[] = [{ slice: preferencesSlice, persist: true }, { slice: referenceDataSlice, persist: true, ttlMs: 24 * HOUR }, { slice: toastSlice }];

configureStore({ reducer: buildReducers(sliceRegistry) });
```

```ts
type SliceConfig = {
  slice: Slice;
  persist?: boolean; // store this slice in localStorage
  ttlMs?: number; // how long the stored copy stays usable
};
```

| Function                            | Returns                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `buildReducers(sliceRegistry)`      | `{ [slice.name]: slice.reducer }` for `configureStore`'s `reducer` |
| `buildInitialState(sliceRegistry)`  | `{ [slice.name]: slice.getInitialState() }`                        |
| `getPersistedSlices(sliceRegistry)` | The configs with `persist: true`                                   |

## Persistence

`loadPersistedState` hydrates the store, `savePersistedState` writes it back from a
subscriber. Only slices marked `persist: true` are stored.

```ts
import { configureStore } from '@reduxjs/toolkit';
import { buildReducers, loadPersistedState, savePersistedState } from '@onivoro/browser-redux';

const store = configureStore({
  reducer: buildReducers(sliceRegistry),
  preloadedState: loadPersistedState(sliceRegistry, 'my-app', {
    defaultTtlMs: 12 * HOUR,
  }),
});

store.subscribe(() => savePersistedState(store.getState(), sliceRegistry, 'my-app'));
```

- `loadPersistedState(sliceRegistry, storageKeyPrefix, options?: { defaultTtlMs?: number })` returns the initial state of every registered slice, with fresh persisted slices substituted in. If storage is empty, unreadable, or written under another version, it returns plain initial state (parse errors are logged with `console.error`).
- `savePersistedState(state, sliceRegistry, storageKeyPrefix)` writes the persisted slices as one JSON envelope. Errors (quota, private mode) are logged with `console.error`.
- Both use the localStorage key from `buildStorageKey(prefix)`, which is `` `${prefix}-state-${location.host}` ``.

### Expiry

A slice's own `ttlMs` wins over `defaultTtlMs`; with neither set it never expires.
An expired slice hydrates to its initial state, which is what prompts the app to
refetch it.

Each slice carries its own timestamp and only slices that actually changed are
re-aged on a write. Without that, one busy slice — a route history that changes on
every navigation — would keep every cache beside it alive indefinitely.

Timestamps that are missing, unparseable, or in the future count as expired: a
clock that moved backwards after a write must not make a cache immortal.

### Versioning

`PERSISTENCE_VERSION` (currently `1`) is stamped into the stored envelope, and a payload written
under any other version is discarded on load. It is a constant in this package, so
changing it means changing the library; bumping it clears stale state for every user
on that release, at the cost of one cold load per browser.

### Write elision

`savePersistedState` runs on every dispatch, most of which touch nothing persisted.
It compares slice references — sound because reducers never mutate — and returns
without serialising when nothing changed. A write that throws (quota, private mode)
is not recorded, so the next dispatch tries again.

## Entity slices

`createEntitySlice<T extends { id: number | string }>(name)` returns a Redux Toolkit slice backed by `createEntityAdapter<T>()`, with extra `focusedId` state and selectors that read from the root state. Register it under its own `name` (as `buildReducers` does), because the selectors look up `state[name]`.

Actions (`slice.actions`):

| Action      | Payload           | Effect              |
| ----------- | ----------------- | ------------------- |
| `addOne`    | `T`               | `adapter.addOne`    |
| `setOne`    | `T`               | `adapter.setOne`    |
| `removeOne` | `T['id']`         | `adapter.removeOne` |
| `setAll`    | `T[]`             | `adapter.setAll`    |
| `removeAll` | none              | `adapter.removeAll` |
| `focusOne`  | `{ id: T['id'] }` | sets `focusedId`    |

Selectors (`slice.selectors`, replacing RTK's own `selectors`; each takes the root state):

| Selector           | Returns                                             |
| ------------------ | --------------------------------------------------- |
| `entities(state)`  | `Record<T['id'], T>` (`{}` if the slice is missing) |
| `ids(state)`       | `readonly T['id'][]` (`[]` if the slice is missing) |
| `focusedId(state)` | `T['id'] \| undefined`                              |
| `focused(state)`   | the entity for `focusedId`, or `undefined`          |

```ts
import { createEntitySlice } from '@onivoro/browser-redux';

type Account = { id: number; name: string };

const accountEntity = createEntitySlice<Account>('accountEntity');

store.dispatch(accountEntity.actions.setAll([{ id: 1, name: 'Checking' }]));
store.dispatch(accountEntity.actions.focusOne({ id: 1 }));

accountEntity.selectors.entities(store.getState()); // { 1: { id: 1, name: 'Checking' } }
accountEntity.selectors.focused(store.getState()); // { id: 1, name: 'Checking' }
```

Notes: `focused` resolves any id, including `0` and `''`; it returns `undefined` only when nothing is focused or the focused id is not in `entities`. The slice state also has a `focused` property initialized to `{}` that no reducer updates; use the `focused` selector instead.

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
