import { createEntityAdapter, createSlice, PayloadAction, EntityState } from '@reduxjs/toolkit';

/**
 * Factory function to create entity slices with standard CRUD operations and focus tracking.
 */
export function createEntitySlice<T extends { id: number | string }>(name: string) {
  const entityAdapter = createEntityAdapter<T>({});

  type ExtendedState = EntityState<T, T['id']> & {
    focused: T;
    focusedId: number | undefined;
  };

  const slice = createSlice({
    name,
    initialState: {
      ...entityAdapter.getInitialState(),
      focused: {} as T,
      focusedId: undefined as number | undefined
    } as ExtendedState,
    reducers: {
      addOne(state, action: PayloadAction<T>) {
        entityAdapter.addOne(state as EntityState<T, T['id']>, action.payload);
      },
      setOne(state, action: PayloadAction<T>) {
        entityAdapter.setOne(state as EntityState<T, T['id']>, action.payload);
      },
      removeOne(state, action: PayloadAction<T['id']>) {
        entityAdapter.removeOne(state as EntityState<T, T['id']>, action.payload);
      },
      setAll(state, action: PayloadAction<T[]>) {
        entityAdapter.setAll(state as EntityState<T, T['id']>, action.payload);
      },
      removeAll(state) {
        entityAdapter.removeAll(state as EntityState<T, T['id']>);
      },
      focusOne(state, { payload }: PayloadAction<{ id: number }>) {
        state.focusedId = payload?.id;
      }
    }
  });

  const customSelectors = {
    entities: (state: any): Record<T['id'], T> => state[name]?.entities || {},
    ids: (state: any): readonly T['id'][] => state[name]?.ids || [],
    focusedId: (state: any): number | undefined => state[name]?.focusedId,
    focused: (state: any): T | undefined => {
      const sliceState = state[name];
      return sliceState?.focusedId ? sliceState.entities[sliceState.focusedId] : undefined;
    },
  };

  return {
    ...slice,
    selectors: customSelectors
  };
}
