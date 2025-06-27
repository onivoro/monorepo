// this seems EXTREMELY hacky compared to Angular but this appears to be idiomatic react ?!?
// the purpose of this constant is to wrap useDispatch for use outside of react components

import { Dispatch } from "react";

export class Dispatcher {
    _dispatch: Dispatch<any> = null as any;

    readonly dispatch = (action: any) => this._dispatch(action);
}


export const dispatcher = new Dispatcher();