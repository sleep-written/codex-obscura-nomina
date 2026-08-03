const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

/**
 * La app se sirve por file:// desde `app/`, que es una copia del build `native`
 * del cliente Angular (base href relativo + routing por hash, justamente para
 * que esto funcione sin servidor).
 *
 * No hay preload ni IPC: en escritorio la app no necesita nada nativo. Exportar
 * un .lyrics usa `<a download>`, que Electron resuelve con su propio diálogo de
 * guardado, e importar usa `<input type="file">`.
 */

function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 480,
    minHeight: 480,
    // Evita el flash blanco antes del primer render con tema oscuro.
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      // La app no tiene ninguna razón para tocar Node; mantenerlo apagado deja
      // el WebView al mismo nivel de privilegio que un navegador.
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  window.once('ready-to-show', () => window.show());
  window.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Cualquier enlace externo va al navegador del sistema, no a una ventana
  // de Electron sin barra de direcciones.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
}

app.whenReady().then(() => {
  // El menú por defecto (File/Edit/View/Window) no aplica a esta app: no hay
  // documentos ni ventanas múltiples, y todas las acciones viven en el toolbar.
  //
  // En Windows y Linux Chromium sigue resolviendo Ctrl+C/V/X/A dentro de los
  // campos de texto sin menú, así que el editor no se ve afectado. En macOS sí
  // haría falta un menú mínimo con los roles de edición — de ahí la guarda.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
