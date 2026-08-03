/**
 * Persiste un valor en `localStorage` bajo una clave fija. Genérica a
 * propósito: no sabe qué guarda, solo serializa/deserializa JSON.
 *
 * Dos escrituras porque hay dos usos con exigencias opuestas: el autoguardado
 * de un borrador puede fallar en silencio, pero un guardado explícito del
 * usuario no — si el almacenamiento está lleno hay que poder avisarlo.
 */
export class JsonStorage<T> {
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

  /** Escritura inmediata; propaga el error si el almacenamiento la rechaza. */
  write(value: T): void {
    // Un debounce pendiente lleva un valor más viejo que este: si se dejara
    // correr, pisaría lo que acabamos de escribir.
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    localStorage.setItem(this.key, JSON.stringify(value));
  }

  /** Escritura diferida para autoguardado; los errores se ignoran. */
  writeDebounced(value: T): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      try {
        localStorage.setItem(this.key, JSON.stringify(value));
      } catch {
        // Sin nadie a quien avisarle: es un autoguardado, no una acción del
        // usuario. El siguiente cambio lo reintenta.
      }
    }, 500);
  }
}
