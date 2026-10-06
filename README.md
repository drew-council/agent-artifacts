# agent-artifacts

Local-first HTML deliverables for coding agents: **React + TypeScript + Tailwind + 40+ shadcn/ui components**, a deterministic build/publication CLI, a background artifact host, and portable ZIP exports.

Based on [Anthropic's web-artifacts-builder](https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder), not a remote artifact service. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned upstream source and licenses.

## Pi installation

Install the skill independently of Home Manager activation:

```sh
pi install git:github.com/drew-council/agent-artifacts
```

Run `/reload` in Pi. This exposes `/skill:html-artifacts` and the agent-facing CLI guidance.
When Pi manages the skill, set `services.agent-artifacts.installPiSkill = false` in Home Manager to avoid duplicate discovery. Home Manager still installs the CLI and configures the background host.

## Agent workflow

```sh
agent-artifacts init ./my-report --title "Quarterly report"
cd my-report
bun install --frozen-lockfile
```

Edit `src/App.tsx`, use `@/components/ui/*`, and fill in `artifact.json`. Shared layouts and CSS tokens give every artifact the same baseline.

```sh
agent-artifacts build .
agent-artifacts submit . --wait --json
```

The build **requires TypeScript checks**, creates a single HTML document with embedded JS/CSS/assets, and records source/output integrity. Submission refuses stale builds and snapshots approved source files. The host never runs submitted scripts.

The background service ingests the filesystem inbox. Once published, the root gallery lists the artifact, with **Open** and **Download ZIP** actions. The returned URL is local to this machine.

## Sharing

Click **Download ZIP**, or run:

```sh
agent-artifacts export <id> --output report.zip
```

The ZIP contains:

- `index.html`: complete offline artifact; recipients simply open it in a browser.
- `source/`: editable TypeScript/React/shadcn source, package manifest and lockfile.
- `README.txt`: viewing/editing instructions.
- `artifact.json`: title, tags, timestamps and integrity hashes; no authoring path.

No upload occurs. Opening an export requires no package installation, server, internet connection, account, or agent harness. Editing/rebuilding source requires Bun (or a suitable Node toolchain) and downloaded dependencies.

## CLI

| Command | Purpose |
| --- | --- |
| `init <directory> [--title T]` | Copy the pinned starter; refuse existing directories |
| `build <directory>` | Type-check, bundle, enforce offline asset rules |
| `submit <directory> [--title T] [--description D] [--tag T] [--wait]` | Atomically queue an immutable snapshot |
| `list` | List published artifacts |
| `status <id>` | Inspect queued/published/failed state |
| `url [id]` | Print the gallery/artifact URL |
| `export <id> --output <file.zip>` | Create an archive without overwriting an existing file |
| `serve` | Run the loopback host and inbox ingestion |

Commands accept `--json`. Repeated submissions create independent snapshots and new IDs; this is not a live workspace mirror or a version-control system.

`submit` works while the host is stopped. `--wait` waits up to ten seconds; a timeout does not discard the submission. Invalid submissions are quarantined, with an error available through `status`.

## Home Manager: NixOS and macOS

```nix
# flake.nix inputs
agent-artifacts = {
  url = "github:drew-council/agent-artifacts";
  inputs.nixpkgs.follows = "nixpkgs";
};
```

Import `inputs.agent-artifacts.homeManagerModules.default` and enable:

```nix
services.agent-artifacts = {
  enable = true;
  port = 41780;
  # dataDir defaults to the user's XDG data home / agent-artifacts.
  # installPiSkill defaults to true.
};
```

The same module creates:

- A configured `agent-artifacts` command and Bun in the user's environment.
- The Pi skill at `~/.pi/agent/skills/html-artifacts/`.
- A systemd user service on Linux.
- A launchd agent on macOS, with automatic restart and local logs.
- Private storage and a JSON configuration file.

The flake also exports `homeManagerModules.nixos`, `homeManagerModules.darwin`, `packages.default`, and `apps.default`. No absolute checkout paths are required on another machine.

Linux diagnostics: `systemctl --user status agent-artifacts` and `journalctl --user -u agent-artifacts`.
macOS logs: `~/Library/Logs/agent-artifacts/{stdout,stderr}.log`.

## Configuration and storage

Defaults: `http://127.0.0.1:41780/` and `~/.local/share/agent-artifacts/`.

`AGENT_ARTIFACTS_CONFIG` names a JSON file containing `dataDir`, `port` and `pollIntervalMs`. Home Manager supplies this automatically.
`AGENT_ARTIFACTS_HOME` and `AGENT_ARTIFACTS_PORT` override storage/port for isolated testing.

```text
agent-artifacts/
  staging/             incomplete CLI copies; never published
  inbox/<id>/          atomically submitted snapshots
  artifacts/<id>/      published HTML + manifest + source
  failed/<id>/         rejected snapshots and error.txt
  host.lock            single-host ownership (dead-process locks recover)
```

Gallery metadata comes from durable manifests, not an in-memory database. A host restart retains artifacts. Manual pruning is currently the user's responsibility; no data is deleted automatically.

## Offline and trust boundaries

- Runtime assets are bundled. No CDN, remote images/fonts, analytics, API fetches, subframes, service workers or external CSS.
- A restrictive CSP is present in the HTML itself, so it travels with ZIP exports. The server also sends it as an HTTP header.
- Hosted HTML runs in an opaque-origin sandbox. It cannot access gallery DOM/storage. Do not depend on localStorage or browser-history routing; use React state and hash routing.
- User-initiated citation links may navigate to another page; they are not runtime dependencies.
- The host binds only to 127.0.0.1, rejects unexpected Host headers, and provides read-only HTTP operations. All publication uses the filesystem CLI.
- There is no telemetry, remote publishing, or cloud integration. Initial dependency installation may contact package registries.
- The build command executes workspace scripts: only build trusted local workspaces. The host only validates/serves snapshots.
- Source snapshots exclude Git internals, dependency trees, .env files, known credential filenames and key/certificate extensions. **This is not a secret scanner.** Review rendered data and source before submitting/sharing.
- Snapshots are limited to 20 MiB HTML, 50 MiB source, and 1,000 source files. Source selection includes src/, public/, scripts/, and named build/config/license files. Symlinks are rejected.
- CSP/sandboxing are browser defenses, not an OS firewall or protection against arbitrary malicious code in a downloaded file. Do not open unfamiliar HTML without reviewing it.

## Development

```sh
bun install --frozen-lockfile
bun run check
nix build
nix fmt
```

Tests use Python's standard-library ZIP reader as an independent interoperability check. The React starter has its own pinned manifest/lockfile and TypeScript checks. Main program runtime has no npm dependencies.

## License

Original code: Apache-2.0 OR MIT. Bundled upstream materials retain their original licenses.
