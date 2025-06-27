import { RouteObject } from "react-router-dom";
import { TStateAwareLoaderFactory } from "./state-aware-loader-factory.type";

export type TRoute = RouteObject & { loaderFactory: TStateAwareLoaderFactory };