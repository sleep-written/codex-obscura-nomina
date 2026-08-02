import * as vscode from 'vscode';
import { LYRICS_TOKEN_COLOR_RULES, mergeTokenColorRules, type TextMateRule } from './token-colors.js';

/**
 * Merges this extension's default `.lyrics` token colors into the user's
 * global `editor.tokenColorCustomizations`, once — see `token-colors.ts` for
 * why a grammar alone can't do this. Runs on every activation, but
 * `mergeTokenColorRules` makes it a no-op once the rules are already there,
 * so it doesn't churn the user's settings file on every reload.
 */
export async function ensureTokenColors(): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const current = config.get<{ textMateRules?: TextMateRule[] } & Record<string, unknown>>(
        'editor.tokenColorCustomizations'
    ) ?? {};

    const merged = mergeTokenColorRules(current.textMateRules ?? [], LYRICS_TOKEN_COLOR_RULES);
    if (merged === null) {
        return;
    }

    await config.update(
        'editor.tokenColorCustomizations',
        { ...current, textMateRules: merged },
        vscode.ConfigurationTarget.Global
    );
}
