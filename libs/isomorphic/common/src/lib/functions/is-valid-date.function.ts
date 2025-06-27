export function isValidDate(dateString: string | Date) {
    const date = new Date(dateString);

    return (date instanceof Date && !isNaN(date.getTime())) ? date : undefined;
}