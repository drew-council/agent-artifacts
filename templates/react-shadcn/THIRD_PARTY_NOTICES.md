# Third-party sources

The React artifact starter and workflow are adapted from Anthropic's web-artifacts-builder:
https://github.com/anthropics/skills/tree/683bc88e56f3e09ba94f7055977f3d3aa499f202/skills/web-artifacts-builder

Upstream commit: 683bc88e56f3e09ba94f7055977f3d3aa499f202.
The original guidance, scripts and Apache-2.0 license are preserved in vendor/anthropic/web-artifacts-builder/.
The 40+ shadcn/ui components were extracted from that commit's scripts/shadcn-components.tar.gz.
The scaffold uses the upstream React/TypeScript/Tailwind/shadcn conventions, with Bun installation and Vite single-file bundling instead of pnpm and Parcel.

shadcn/ui component code is MIT-licensed (https://github.com/shadcn-ui/ui).
The license is included in templates/react-shadcn/LICENSE-MIT-SHADCN.
The theme uses the Catppuccin Mocha palette (MIT, https://github.com/catppuccin/catppuccin).
Noto Sans and JetBrains Mono are SIL Open Font License 1.1 fonts, installed from Fontsource and embedded in built artifacts.
Syntax highlighting uses Shiki (MIT, https://github.com/shikijs/shiki) and its Catppuccin Mocha theme.
Other packages retain their own licenses; dependency versions are pinned in package.json and bun.lock.

Original agent-artifacts code is licensed under Apache-2.0 OR MIT, as described by LICENSE-APACHE and LICENSE-MIT.
