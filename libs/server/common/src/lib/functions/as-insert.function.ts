// TODO: DEPRECATE THIS
export function asInsert(table: string, objects: Array<Record<string, any>>) {
    const statements: string[] = [];

    objects.forEach(obj => {
        const columns = Object.keys(obj);
        statements.push(`insert into "${table}" (${columns.map(c => `"${c}"`).join(', ')}) values (${columns.map(c => getValueExpression(c, obj[c])).join(', ')});`);
    });

    return statements;
}

function getValueExpression(columnName: string, value: any) {
    const result = getValueExpressionInner(columnName, value);
    if(!result) {
        console.log(`${columnName} has value "${result}"`)
    }
    return result;
}


function getValueExpressionInner(columnName: string, value: any) {
    if ((value === null) || (typeof value === 'undefined') || (value === "null")) {
        return 'null';
    }

    if (typeof value === "string") {
        return `'${value}'`;
    }

    if (typeof value === "number") {
        return value;
    }

    if (typeof value === 'boolean') {
        return value.toString().toUpperCase();
    }

    // if (Array.isArray(value)) {
    return `'${JSON.stringify(value)}'::jsonb`;
    // }
}