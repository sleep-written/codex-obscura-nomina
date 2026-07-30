/**
 * Represents a single grapheme (user-perceived character) extracted from a
 * source string, tracking its column and row position within that string.
 */
export class Character {
    /**
     * Splits an input string into its grapheme clusters using `Intl.Segmenter`,
     * wrapping each one in a {@link Character} that carries its 1-based
     * column/row position. The row is incremented on every `\n` segment, and
     * the column resets to `1` at the start of each new row.
     *
     * @param input - The string to split into characters.
     *
     * @param locales - A string with a [BCP 47 language tag](http://tools.ietf.org/html/rfc5646), or an array of such strings.
     * For the general form and interpretation of the `locales` argument,
     * see the [`Intl` page](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl#Locale_identification_and_negotiation).
     *
     * @param localeMatcher
     * The locale matching algorithm to use. Possible values are `"lookup"` and `"best fit"`; the default is `"best fit"`.
     * For information about this option, see [Locale identification and negotiation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locale_identification_and_negotiation).
     *
     * @returns An array of {@link Character} instances, one per grapheme cluster in `input`.
     */
    static split(
        input: string,
        locales?: Intl.LocalesArgument,
        localeMatcher?: Intl.SegmenterOptions['localeMatcher']
    ): Character[] {
        const characters: Character[] = [];
        const segmenter = new Intl.Segmenter(locales, {
            granularity: 'grapheme',
            localeMatcher,
        });

        let col = 1;
        let row = 1;
        for (const { segment } of segmenter.segment(input)) {
            characters.push(new Character(segment, col, row));

            if (segment === '\n') {
                row++;
                col = 1;
            } else {
                col++;
            }
        }

        return characters;
    }

    #v: string;
    #col: number;
    /** 1-based column of this character within its row. */
    get col(): number {
        return this.#col;
    }

    #row: number;
    /** 1-based row (line number) of this character within the source string. */
    get row(): number {
        return this.#row;
    }

    /**
     * @param v - The grapheme cluster this instance represents.
     * @param col - 1-based column of `v` within its row.
     * @param row - 1-based row (line number) of `v` within the source string.
     */
    constructor(v: string, col: number, row: number) {
        this.#v = v;
        this.#col = col;
        this.#row = row;
    }

    /**
     * @returns The underlying grapheme cluster.
     */
    toString(): string {
        return this.#v;
    }
}