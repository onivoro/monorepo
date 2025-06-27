import { LoaderFunction } from "react-router-dom";
import { Dispatch } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";

export type TStateAwareLoaderFactory = (params: { dispatch: Dispatch<any>, select: typeof useSelector }) => LoaderFunction;