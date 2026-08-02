import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FileIo {
  readTextFile(file: File): Promise<string> {
    return file.text();
  }

  downloadText(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
