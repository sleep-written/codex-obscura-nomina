import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    // .cjs, not .js: package.json has "type": "module" (needed so the test
    // script can run .ts test files as ESM via @bleed-believer/cli), but
    // this bundle is CommonJS (format: 'cjs') — a plain .js extension here
    // would make Node treat CJS syntax as ES module scope and crash on
    // `module`/`require` not being defined.
    outfile: 'dist/extension.cjs',
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    external: ['vscode'],
    sourcemap: true,
    // Pin the tsconfig explicitly: without this, esbuild's per-file upward
    // directory search picks up ../lyrics-language/tsconfig.json for the
    // bundled dependency's dist files (its target: "es2025" isn't a target
    // esbuild recognizes yet) — pinning avoids that lookup entirely.
    tsconfig: 'tsconfig.json'
});

if (watch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}
