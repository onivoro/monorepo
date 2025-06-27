export async function copy(text: string, onComplete?: (error?: any) => any) {
    try {
        await navigator.clipboard.writeText(text);
        onComplete?.();
    } catch (error: any) {
        onComplete?.(error);
    }
}