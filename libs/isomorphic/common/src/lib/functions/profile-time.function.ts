const PROFILE_TIME = 'PROFILE_TIME';

export async function profileTime<T>(fn: () => Promise<T>) {
    const start = Date.now();
    console.log({ PROFILE_TIME, fn: fn.toString(), start });
    const _ = await fn();
    const end = Date.now();
    console.log({ PROFILE_TIME, fn: fn.toString(), end, elapsed: (end - start) / 1000 });

    return _;
}