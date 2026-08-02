/**
 * Persiste un valor en `localStorage` bajo una clave fija, con debounce en
 * la escritura. Genérica a propósito: no sabe qué es una canción, solo
 * serializa/deserializa JSON.
 */
export class DraftStorage<T> {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly key: string) {}

  read(): T | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  write(value: T): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      localStorage.setItem(this.key, JSON.stringify(value));
    }, 500);
  }
}
