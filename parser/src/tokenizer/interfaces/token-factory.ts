export interface TokenFactory {
    hold?(acum: string): boolean;
    close(next?: string): boolean;
}