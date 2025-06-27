export function round(numberToRound: number, scalingFactor: number) {
    const scaledServingDose = numberToRound * scalingFactor;
    return Math.round(scaledServingDose) / scalingFactor;
}
