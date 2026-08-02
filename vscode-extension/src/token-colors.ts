/**
 * Default colors for this extension's custom `.lyrics` TextMate scopes.
 *
 * Pure data + merge logic, no `vscode` import — a grammar only assigns
 * scopes, the actual color always comes from the active color theme, and
 * plenty of themes simply never define a rule for an unfamiliar scope (they
 * fall back to the theme's plain default foreground). The only way to force
 * a color in from a language extension is to write to the user's own
 * `editor.tokenColorCustomizations`, done by the `vscode`-coupled caller in
 * `activation.ts` using {@link mergeTokenColorRules} below.
 */

export interface TextMateRule {
    scope: string;
    settings: { foreground?: string; fontStyle?: string };
}

export const LYRICS_TOKEN_COLOR_RULES: TextMateRule[] = [
    { scope: 'punctuation.separator.syllable.lyrics', settings: { foreground: '#5c5c5c' } },
    { scope: 'keyword.operator.sinalefa.lyrics', settings: { foreground: '#4caf50' } },
    { scope: 'keyword.operator.diaeresis-on.lyrics', settings: { foreground: '#4caf50' } },
    { scope: 'keyword.operator.synaeresis-on.lyrics', settings: { foreground: '#4caf50' } },
    { scope: 'keyword.operator.diaeresis-off.lyrics', settings: { foreground: '#4a9eff' } },
    { scope: 'keyword.operator.synaeresis-off.lyrics', settings: { foreground: '#4a9eff' } }
];

/**
 * Appends whichever of `ours` aren't already covered by `existingRules`
 * (matched by `scope`, so a user's own customization of one of these exact
 * scopes is left untouched). Returns `null` if there's nothing to add, so
 * the caller can skip writing to settings entirely.
 */
export function mergeTokenColorRules(existingRules: TextMateRule[], ours: TextMateRule[]): TextMateRule[] | null {
    const covered = new Set(existingRules.map(rule => rule.scope));
    const missing = ours.filter(rule => !covered.has(rule.scope));
    return missing.length === 0 ? null : [...existingRules, ...missing];
}
