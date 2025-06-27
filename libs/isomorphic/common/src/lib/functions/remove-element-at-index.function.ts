export function removeElementAtIndex<T>(array: T[], indexToRemove: number): T[] {
    const newArray: T[] = [];
    (array || []).forEach((element, index) => {
        if(index !== indexToRemove) {
            newArray.push(element);
        }
    });
    return newArray;
}