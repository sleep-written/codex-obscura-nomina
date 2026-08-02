const STRONG_BASE = new Set(['a', 'e', 'o']);
const WEAK_BASE = new Set(['i', 'u']);

/** Maps an accented vowel to its unaccented base, to look up its strength. */
const ACCENTED_BASE: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u'
};

export interface VowelInfo {
    strength: 'strong' | 'weak';
    accented: boolean;
}

/**
 * Classifies a single grapheme as a Spanish vowel, or `null` if it's a
 * consonant. `ü` always counts as a weak vowel (orthographic diéresis, as in
 * "cigüeña") — callers that need to silence a `u` after `g`/`q` before
 * `e`/`i` must do so themselves, since that's a positional rule, not a
 * property of the letter itself.
 */
export function classifyVowelChar(ch: string): VowelInfo | null {
    const lower = ch.toLowerCase();

    if (lower === 'ü') {
        return { strength: 'weak', accented: false };
    }
    if (lower in ACCENTED_BASE) {
        const base = ACCENTED_BASE[lower];
        return { strength: STRONG_BASE.has(base) ? 'strong' : 'weak', accented: true };
    }
    if (STRONG_BASE.has(lower)) {
        return { strength: 'strong', accented: false };
    }
    if (WEAK_BASE.has(lower)) {
        return { strength: 'weak', accented: false };
    }
    return null;
}

/**
 * Classifies an adjacent pair of vowels as a natural diphthong or hiato:
 * hiato if both are strong, or if the weak one of the pair carries a written
 * accent (hiato acentual, e.g. "día"); diphthong otherwise. A strong vowel
 * carrying an accent (e.g. the "á" in "diálogo") does NOT by itself force a
 * hiato — only an accented weak vowel does.
 */
export function classifyVowelPair(a: VowelInfo, b: VowelInfo): 'diphthong' | 'hiato' {
    if (a.strength === 'strong' && b.strength === 'strong') {
        return 'hiato';
    }
    if (a.strength === 'weak' && a.accented) {
        return 'hiato';
    }
    if (b.strength === 'weak' && b.accented) {
        return 'hiato';
    }
    return 'diphthong';
}
