/* eslint no-global-assign:0 */
export async function useDate(date: string, fn: () => Promise<void>) {
    const mockedDate = new Date(date);

    const OriginalDate = Date;

    Date = class extends OriginalDate {
        constructor(...args: any[]) {
            super(
                (args.length === 0) ? mockedDate : new (OriginalDate as any)(...args)
            );
        }
        static override now() {
            return mockedDate.getTime();
        }
    } as any;

    await fn();

    Date = OriginalDate;
}