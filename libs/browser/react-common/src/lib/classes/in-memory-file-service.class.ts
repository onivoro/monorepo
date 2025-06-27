export class InMemoryFileService {
    static downloadBlob(blob: Blob, fileName: string) {
        const fileURL = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = fileURL;
        downloadLink.download = fileName;
        downloadLink.click();
        URL.revokeObjectURL(fileURL);
    }

    static downloadContent(content: any, type: string, fileName: string) {
        const blob = new Blob([content], { type });
        InMemoryFileService.downloadBlob(blob, fileName);
    }

    static downloadCsvContent(rows: string[], fileName: string) {
        InMemoryFileService.downloadContent(rows.join('\n'), 'text/csv', fileName);
    }

    static downloadSvgContent(element: HTMLElement, fileName: string) {
        InMemoryFileService.downloadContent(element.innerHTML, 'image/svg+xml', fileName);
    }
}