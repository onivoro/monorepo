// this seems EXTREMELY hacky compared to Angular but this appears to be idiomatic react ?!?
// adapted from (with many modifications) => https://jasonwatmore.com/react-router-6-navigate-outside-react-components#:~:text=To%20get%20around%20this%20you,navigate()%20.

import { NavigateFunction, NavigateOptions, To } from "react-router-dom";

export class Router {
    _navigate: NavigateFunction = null as any;
    readonly navigate = (to: To, options?: NavigateOptions) => {
        if(this._navigate as any) {
            this._navigate(to, options);
        }
    };
}

export const router = new Router();