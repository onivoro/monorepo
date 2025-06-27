export function toDecimalBase(n: string | number, base = 16) {
    const digits = n.toString().split('');

    let answer = 0;

    digits.reverse().forEach(function (d, i) {
        let actualNumber = Number(d);

        if (!actualNumber && actualNumber !== 0) {
            const codeAt = d.charCodeAt(0);

            if (codeAt >= 97) {
                actualNumber = codeAt - 87;
            } else {
                actualNumber = codeAt - 55;
            }
        }

        answer = answer + actualNumber * Math.pow(base, i);
    });

    return answer;
}