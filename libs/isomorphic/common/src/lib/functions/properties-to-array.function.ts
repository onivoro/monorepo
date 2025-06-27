// credit https://stackoverflow.com/questions/15690706/recursively-looping-through-an-object-to-build-a-property-list/53620876#53620876

export function propertiesToArray(obj: Record<string, any>) {
    const isObject = (val: any) =>
        val && typeof val === 'object' && !Array.isArray(val);

    const addDelimiter = (a: any, b: any) =>
        a ? `${a}.${b}` : b;

    const paths: any = (obj = {}, head = '') => {
        return Object.entries(obj)
            .reduce((product, [key, value]) => {
                let fullPath = addDelimiter(head, key)
                return isObject(value) ?
                    product.concat(paths(value, fullPath))
                    : product.concat(fullPath)
            }, []);
    }

    return paths(obj);
}
