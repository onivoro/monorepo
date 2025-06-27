import { act, useEffect, useMemo, useState } from "react";
import { KeyPressContext } from '../contexts/key-press.context';

export const KeyPressProvider = ({ children }: any) => {
    const [special, setSpecial] = useState(false);
    const [pressedKeys, setPressedKeys] = useState([] as any[]);
    const [activeModifiers, setActiveModifiers] = useState({
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
    });

    useEffect(() => {
        const handleKeyDown = (event: any) => {
            if(event.metaKey) {
                setPressedKeys(prev => [...(prev.filter(_ => ['Meta', 'Shift'].includes(_))), event.key]);
            } else {
                setPressedKeys(prev => prev.includes(event.key) ? [...prev] : [...prev, event.key]);
            }

            setActiveModifiers({
                ctrl: event.ctrlKey,
                alt: event.altKey,
                shift: event.shiftKey,
                meta: event.metaKey,
            });
        };

        const handleKeyUp = (event: any) => {
            setPressedKeys(prev =>  prev.filter(_ => _ !== event.key));

            setActiveModifiers({
                ctrl: event.ctrlKey,
                alt: event.altKey,
                shift: event.shiftKey,
                meta: event.metaKey,
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        setSpecial(activeModifiers.shift && activeModifiers.meta);
    }, [activeModifiers])

    return (
        <KeyPressContext.Provider value={{
            pressedKeys,
            activeModifiers,
            special
        }}>
            {children}
        </KeyPressContext.Provider>
    );
};