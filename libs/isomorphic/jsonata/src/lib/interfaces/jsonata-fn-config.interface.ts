import { IJsonataFn } from "./jsonata-fn.interface";

export interface IJsonataFunctions {
    headerFunctions?: IJsonataFn[];
    auxilaryHeaderFunctions?: IJsonataFn[];
    registerFunctions?: Array<Pick<IJsonataFn, 'name'> & { fn: Function }>
}
