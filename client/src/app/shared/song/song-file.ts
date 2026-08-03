import { printLyrics } from '@codex-obscura-nomina/lyrics-language';
import { toSongNode } from '../lyrics/song-node';
import type { SongVm } from './song-vm';

/** Marcas diacríticas que deja sueltas `normalize('NFD')`. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Texto libre → una forma comparable y apta para un nombre de archivo: sin
 * mayúsculas, sin tildes y sin nada que no sea alfanumérico. Es la misma
 * normalización para nombrar el `.lyrics` y para decidir si dos canciones son
 * la misma, a propósito: «Nocturno» y «nocturno » deben coincidir en ambos.
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function lyricsFileName(title: string): string {
  return `${slugify(title) || 'cancion'}.lyrics`;
}

export function toLyricsText(song: SongVm): string {
  return printLyrics(toSongNode(song));
}

/**
 * Si dos canciones son "la misma" a efectos de importar. El par título+artista
 * es lo que identifica una canción en la práctica; el álbum queda fuera porque
 * la misma canción se guarda a veces sin él.
 *
 * Un artista vacío no descarta la coincidencia: un `.lyrics` sin metadata que
 * choque de título con algo guardado es casi siempre otra versión del mismo
 * trabajo, y preguntar de más es preferible a duplicar en silencio. Una canción
 * sin título, en cambio, no coincide con nada: no tiene identidad que comparar.
 */
export function isSameSong(a: SongVm, b: SongVm): boolean {
  const title = slugify(a.title);
  if (title === '' || title !== slugify(b.title)) return false;
  const artistA = slugify(a.metadata.artist);
  const artistB = slugify(b.metadata.artist);
  return artistA === '' || artistB === '' || artistA === artistB;
}
