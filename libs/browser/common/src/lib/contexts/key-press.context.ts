import { createContext } from "react";

export const KeyPressContext = createContext({
    pressedKeys: [] as any[],
    activeModifiers: {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
    },
    special: false,
});