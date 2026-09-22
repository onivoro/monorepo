import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
  EntityState,
} from '@reduxjs/toolkit';

/**
 * Factory function to create entity slices with standard CRUD operations and focus tracking.
 * Reduces boilerplate by generating the repetitive slice code.
 *
 * @param name - The name of the slice (e.g., 'accountEntity')
 * @returns A configured Redux Toolkit slice with entity adapter and focus functionality
 */
export function createEntitySlice<T extends { id: number | string }>(
  name: string,
) {
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
      focusedId: undefined as number | undefined,
    } as ExtendedState,
    reducers: {
      addOne(state, action: PayloadAction<T>) {
        entityAdapter.addOne(state as EntityState<T, T['id']>, action.payload);
      },
      setOne(state, action: PayloadAction<T>) {
        entityAdapter.setOne(state as EntityState<T, T['id']>, action.payload);
      },
      removeOne(state, action: PayloadAction<T['id']>) {
        entityAdapter.removeOne(
          state as EntityState<T, T['id']>,
          action.payload,
        );
      },
      setAll(state, action: PayloadAction<T[]>) {
        entityAdapter.setAll(state as EntityState<T, T['id']>, action.payload);
      },
      removeAll(state) {
        entityAdapter.removeAll(state as EntityState<T, T['id']>);
      },
      focusOne(state, { payload }: PayloadAction<{ id: number }>) {
        state.focusedId = payload?.id;
      },
    },
  });

  // Manually create selectors that work with root state
  // These are properly typed to ensure correct type inference at consumption points
  const customSelectors = {
    entities: (state: any): Record<T['id'], T> => state[name]?.entities || {},
    ids: (state: any): readonly T['id'][] => state[name]?.ids || [],
    focusedId: (state: any): number | undefined => state[name]?.focusedId,
    focused: (state: any): T | undefined => {
      const sliceState = state[name];
      return sliceState?.focusedId
        ? sliceState.entities[sliceState.focusedId]
        : undefined;
    },
  };

  // Return the slice with properly typed actions and custom selectors
  return {
    ...slice,
    selectors: customSelectors,
  };
}
