import { Character } from './character.js';
import type { Token, TokenFactory } from './interfaces/index.js';

export class Tokenizer<T extends { [K: string]: TokenFactory | (new() => TokenFactory); }> {
    static #instantiate(factory: TokenFactory | (new() => TokenFactory)): TokenFactory {
        return typeof factory === 'function' ? new factory() : factory;
    }

    #factories: T;

    constructor(factories: T) {
        this.#factories = factories;
    }

    tokenize(...args: Parameters<typeof Character.split>): Token<keyof T>[] {
        const chars = Character.split(...args);
        const tokens: Token<keyof T>[] = [];

        const entries = (Object.keys(this.#factories) as (keyof T)[]).map(key => ({
            key,
            factory: Tokenizer.#instantiate(this.#factories[key])
        }));

        let i = 0;
        while (i < chars.length) {
            const start = chars[i];

            let acum = '';
            let alive = entries;
            let j = i;

            while (alive.length > 0) {
                const next = j < chars.length ? chars[j].toString() : undefined;
                const survivors = alive.filter(({ factory }) => factory.close(next));

                if (survivors.length === 0) {
                    break;
                }

                alive = survivors;
                if (next === undefined) {
                    break;
                }

                acum += next;
                j++;
            }

            if (acum.length === 0) {
                // No factory recognizes `start` even as the first character of
                // a token: force it into a single-character token so tokenize
                // keeps making progress instead of looping forever.
                acum = start.toString();
                alive = entries;
                j = i + 1;
            }

            const type = (
                alive.find(({ factory }) => factory.hold?.(acum) ?? true) ??
                alive[0]
            ).key;

            tokens.push({
                type,
                value: acum,

                line: start.row,
                column: start.col,
                length: acum.length
            });

            i = j;
        }

        return tokens;
    }
}
