---
name: html-artifacts
description: Create local interactive HTML artifacts using React, TypeScript, Tailwind and shadcn/ui. Use for reports, dashboards, comparisons, explainers, mockups, or tools that benefit from browser presentation. Build, type-check, submit to the local artifact gallery, and provide a shareable offline ZIP when requested.
---

# Local HTML artifacts

Use the installed `agent-artifacts` CLI. Run `agent-artifacts --help` to inspect commands.
This skill adapts Anthropic's web-artifacts-builder, but publication and sharing are entirely local.

## Workflow

1. Create a dedicated workspace outside the application source tree. Use `tmp` for a temporary parent, or a durable workspace when future edits matter.
   Run `agent-artifacts init <workspace> --title "<title>"`.
2. Enter the workspace and run `bun install --frozen-lockfile`.
   This downloads pinned dependencies when uncached; it does not upload artifact data.
3. Read `src/App.tsx`, `src/components/artifact-layout.tsx`, and `src/index.css`.
   Edit the artifact, using TypeScript and the included shadcn components. Set title, description and useful tags in `artifact.json`.
4. Run `agent-artifacts build <workspace>`. This requires type-checking to pass, bundles React/CSS/assets into one HTML document, enforces offline asset rules, and records source/build integrity. Do not bypass it with `bun run build` for publication.
5. Verify the finished `dist/index.html` in a browser. Exercise important interactions; check the console and narrow-screen layout. Do not claim browser verification unless actually performed.
6. Run `agent-artifacts submit <workspace> --wait --json`. A background service ingests the immutable source/output snapshot and adds it to the gallery. Return its URL and a brief summary, rather than pasting the whole artifact into chat.
7. When sharing is requested, use the gallery's **Download ZIP** button or `agent-artifacts export <id> --output <path.zip>`. This creates a local archive; never upload it without explicit authorization.

Do not launch another host if Home Manager manages it. If submission stays queued, inspect `agent-artifacts status <id>`; on Linux inspect `systemctl --user status agent-artifacts`. The completed snapshot remains queued while the host is unavailable.

## Components and consistency

- React 18, TypeScript, Vite, Tailwind 3 and 40+ shadcn/ui components are preconfigured and pinned.
- Import components from `@/components/ui/<component>`.
- Use `ArtifactLayout`, `Metric` and `Note` from `@/components/artifact-layout` for a consistent baseline.
- Keep the shared spacing, typography, colors and CSS variables. Extend thoughtfully rather than inventing a different palette for every report.
- Use meaningful headings, keyboard-operable controls, labelled inputs, visible focus and responsive layouts.
- Avoid excessive centered layouts, purple gradients, uniform card grids for all content, decorative emoji headers and gratuitous animation.
- Reports should answer the user's question first. Interactive controls should clarify the content, not obscure it.
- Prefer the existing component library over hand-built dialog/menu accessibility.

## Offline contract

The HTML is the complete runnable deliverable: inline JS, CSS and assets. No CDN scripts, remote fonts, analytics, API calls, remote images, embedded frames or service workers.
Import images/fonts from `src/` so Vite embeds them; do not add runtime assets to `public/`.
Use embedded datasets, React state, local file inputs and in-memory computations.
Use hash routing if needed. The preview uses an opaque-origin iframe: localStorage/sessionStorage and some clipboard/file-system APIs may be unavailable. Do not rely on them.
External citation links are user-initiated navigation, not runtime data dependencies.
Built HTML has a restrictive Content Security Policy, including in exported archives.

## Publication and sharing safety

Submission copies a snapshot, not a live reference. Later edits need another build/submission and receive a new ID.
Source is included in exports. Check both rendered data and source for secrets/private information before submitting or sharing.
The snapshot excludes node_modules, Git internals, .env files, credential files and private-key extensions. This is not a comprehensive secret scanner.
The host never executes submitted build scripts, never uploads data, and only listens on 127.0.0.1.
ZIP recipients can open index.html without installation/internet. Rebuilding source requires Bun and dependency installation.
