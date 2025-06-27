import { CommandRunner } from 'nest-commander';

export abstract class AbstractCommand<TParams extends Record<string, string | number>> extends CommandRunner {
    abstract main(args: string[], params: TParams): Promise<void>;

    constructor(public name: string) {
        super();
    }

    async run(_args: string[], params: TParams): Promise<void> {
        try {
            await this.main(_args, params);
            process.exit(0);
        } catch (error) {
            console.error({error});
            process.exit(1);
        }

    }
}
