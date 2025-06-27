import { PinoLogger } from 'nestjs-pino';

export function patchConsole(logger: PinoLogger) {
    const _console = logger;

    const original = {
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        trace: console.trace,
        warn: console.warn,
    };

    console.debug = (...args) => {
        _console.debug({msg: args});
    };

    console.error = (...args) => {
        _console.error({msg: args});
    };

    console.info = (...args) => {
        _console.info({msg: args});
    };

    console.log = (...args) => {
        _console.info({msg: args});
    };

    console.trace = (...args) => {
        _console.trace({msg: args});
    };

    console.warn = (...args) => {
        _console.warn({msg: args});
    };

    return {
        _console,
        restore: () => {
            Object.entries(original).forEach(([method, implementation]) => {
                (console as any)[method] = implementation;
            });
        }
    };
}
