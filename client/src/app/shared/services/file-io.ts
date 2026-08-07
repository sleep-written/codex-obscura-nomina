import { Injectable } from '@angular/core';

import { Directory, Encoding, Filesystem, Share } from '../native/plugins';
import { isAndroid } from '../native/platform';

@Injectable({ providedIn: 'root' })
export class FileIo {
  readTextFile(file: File): Promise<string> {
    return file.text();
  }

  /**
   * Un archivo que llega desde otra app de Android (`content://` casi siempre,
   * `file://` en apps viejas). No hay `File` que leer: solo la URI del intent,
   * y el permiso de lectura que Android concede junto con el.
   *
   * Se pasa sin `directory` a proposito — ver `FilesystemPlugin.readFile`.
   */
  async readTextFileFromUri(uri: string): Promise<string> {
    const { data } = await Filesystem.readFile({ path: uri, encoding: Encoding.UTF8 });
    return data;
  }

  /**
   * En web y en Electron basta con `<a download>`: Chromium abre su diálogo de
   * guardado. El WebView de Android, en cambio, lo ignora en silencio — ni
   * descarga ni lanza error — así que allí hay que escribir el archivo y
   * delegar en el share sheet para que el usuario elija destino.
   */
  async downloadText(text: string, filename: string): Promise<void> {
    if (isAndroid()) {
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data: text,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      try {
        await Share.share({ title: filename, files: [uri], dialogTitle: `Exportar ${filename}` });
      } catch (error) {
        // Cerrar el share sheet sin elegir destino llega como error; no lo es.
        if (!/cancel/i.test(String(error))) throw error;
      }
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
