export function mockCalls(jestFn: any, label = 'mock-calls') {
    const calls = jestFn?.mock?.calls || [];
    return { [`${label} -->> ${calls.length} invocation(s)`]: calls };
}