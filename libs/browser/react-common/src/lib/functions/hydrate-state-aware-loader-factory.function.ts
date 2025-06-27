import { Dispatch } from "@reduxjs/toolkit";
import { RouteObject } from "react-router-dom";
import { TRoute } from '../types/route.type';
import { selectFactory } from "./select-factory.function";

export function hydrateStateAwareLoaderFactory(route: TRoute | RouteObject, dispatch: Dispatch<any>, { getState }: { getState: () => any }) {
  return {
    ...route,
    loader: (typeof (route as TRoute).loaderFactory === 'undefined')
      ? route.loader
      : (route as TRoute).loaderFactory({
        dispatch, select: selectFactory({ getState }) as any
      })
  };
}
