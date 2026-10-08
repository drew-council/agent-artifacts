# Artifact workspace

React 18 + TypeScript + Vite + Tailwind 3 + 40+ shadcn/ui components, adapted from Anthropic's web-artifacts-builder.

- Install: `bun install --frozen-lockfile`
- Develop: `bun run dev`
- Check: `bun run typecheck`
- Bundle: `bun run build`
- Publish locally: `agent-artifacts build .` then `agent-artifacts submit . --wait`

Use `@/components/ui/*`, `@/components/artifact-layout`, and the shared CSS tokens.
The theme is Catppuccin Mocha with a mauve primary; the full palette is available as `ctp-*` Tailwind colors. Text uses Noto Sans (`font-sans`) and code uses JetBrains Mono (`font-mono`).
Use `CodeBlock` from `@/components/code-block` for syntax-highlighted code.
Keep data local. Import assets from src/; public/ assets cannot be embedded by the single-file build.
Use hash routing rather than browser-history routing. Do not rely on localStorage in the isolated host.
Metadata lives in artifact.json. Submission includes a source snapshot; exclude private material.

The ZIP's top-level index.html is a complete, offline runnable artifact. Source editing/building requires dependencies, but viewing does not.
