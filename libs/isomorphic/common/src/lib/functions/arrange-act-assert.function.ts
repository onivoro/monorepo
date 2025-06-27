// YOU MUST AWAIT THIS FUNCTION WHEN INVOKING IT!!!

// TODO: PUT THIS IN A TEST-ONLY LIBRARY => LIBS/ISO/JEST

export async function arrangeActAssert<TArrangeOutput, TActOutput>({ arrange, act, assert }: { arrange: () => TArrangeOutput, act: (_: TArrangeOutput) => TActOutput, assert: (_: TArrangeOutput & { result: TActOutput }) => any }) {
    const arrangeOutput = arrange();

    const actInput = isPromise(arrangeOutput) ? await arrangeOutput : arrangeOutput;

    const actOutput = act(actInput);

    const assertInput = isPromise(actOutput) ? await actOutput : actOutput;

    const assertOutput = assert({ ...actInput, result: assertInput });

    const returnValue = isPromise(assertOutput) ? await assertOutput : assertOutput;

    return returnValue;
}

function isPromise(value: any) {
    return (typeof value?.then) === 'function';
}