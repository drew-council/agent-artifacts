# Third-party sources

The React artifact starter and workflow are adapted from Anthropic's web-artifacts-builder:
https://github.com/anthropics/skills/tree/683bc88e56f3e09ba94f7055977f3d3aa499f202/skills/web-artifacts-builder

Upstream commit: 683bc88e56f3e09ba94f7055977f3d3aa499f202.
The original guidance, scripts and Apache-2.0 license are preserved in vendor/anthropic/web-artifacts-builder/.
The 40+ shadcn/ui components were extracted from that commit's scripts/shadcn-components.tar.gz.
The scaffold uses the upstream React/TypeScript/Tailwind/shadcn conventions, with Bun installation and Vite single-file bundling instead of pnpm and Parcel.

shadcn/ui component code is MIT-licensed (https://github.com/shadcn-ui/ui).
The license is included in templates/react-shadcn/LICENSE-MIT-SHADCN.
Other packages retain their own licenses; dependency versions are pinned in package.json and bun.lock.

Original agent-artifacts code is licensed under Apache-2.0 OR MIT, as described by LICENSE-APACHE and LICENSE-MIT.
