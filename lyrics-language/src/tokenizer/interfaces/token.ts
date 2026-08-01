export interface Token<T extends string | number | symbol> {
    value: string;
    length: number;

    type: T;
    line: number;
    column: number;
}
