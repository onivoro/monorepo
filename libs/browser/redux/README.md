# @onivoro/browser-redux

Redux Toolkit utilities for creating entity slices with built-in CRUD operations and localStorage persistence.

## Installation

```bash
npm install @onivoro/browser-redux
```

## Slice registry

Declare the store's slices once, marking which ones survive a reload:

```ts
import { buildReducers, SliceConfig } from '@onivoro/browser-redux';

const HOUR = 60 * 60 * 1000;

export const sliceRegistry: SliceConfig[] = [{ slice: preferencesSlice, persist: true }, { slice: referenceDataSlice, persist: true, ttlMs: 24 * HOUR }, { slice: toastSlice }];

configureStore({ reducer: buildReducers(sliceRegistry) });
```

## Persistence

`loadPersistedState` hydrates the store, `savePersistedState` writes it back from a
subscriber. Only slices marked `persist: true` are stored.

```ts
import { loadPersistedState, savePersistedState } from '@onivoro/browser-redux';

const store = configureStore({
  reducer: buildReducers(sliceRegistry),
  preloadedState: loadPersistedState(sliceRegistry, 'my-app', {
    defaultTtlMs: 12 * HOUR,
  }),
});

store.subscribe(() => savePersistedState(store.getState(), sliceRegistry, 'my-app'));
```

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

`PERSISTENCE_VERSION` is stamped into the stored envelope, and a payload written
under any other version is discarded on load. Bump it when a persisted slice
changes shape, or to clear stale state for every user on a release. The cost is one
cold load per browser.

### Write elision

`savePersistedState` runs on every dispatch, most of which touch nothing persisted.
It compares slice references — sound because reducers never mutate — and returns
without serialising when nothing changed. A write that throws (quota, private mode)
is not recorded, so the next dispatch tries again.

## Entity slices

```ts
import { createEntitySlice } from '@onivoro/browser-redux';

const accountEntity = createEntitySlice<Account>('accountEntity');

accountEntity.selectors.all(state);
accountEntity.selectors.focused(state);
```

## License

MIT
