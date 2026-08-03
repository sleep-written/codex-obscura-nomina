/**
 * Persiste un valor en `localStorage` bajo una clave fija. Genérica a
 * propósito: no sabe qué guarda, solo serializa/deserializa JSON.
 */
export class JsonStorage<T> {
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

  /** Propaga el error si el almacenamiento rechaza la escritura (p. ej. lleno). */
  write(value: T): void {
    localStorage.setItem(this.key, JSON.stringify(value));
  }
}
