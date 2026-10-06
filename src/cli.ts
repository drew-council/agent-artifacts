import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { baseUrl, loadConfig } from "./config.ts";
import { assertId } from "./files.ts";
import { buildProject, initProject } from "./project.ts";
import { startServer } from "./server.ts";
import { archive, list, status, submit } from "./store.ts";

const HELP = `agent-artifacts — local React/TypeScript/shadcn artifacts
  init <directory> [--title <title>]    Copy the pinned starter (does not install)
  build <directory>                   Type-check, bundle, enforce offline assets
  submit <directory> [--title T] [--description D] [--tag T] [--wait]
                                      Queue an immutable, verified snapshot
  list                                List published artifacts
  status <id>                         Inspect queued/published/failed state
  export <id> --output <file.zip>      Export HTML + editable source
  url [id]                            Print gallery or artifact URL
  serve                               Run inbox ingestion and localhost host
  skill                               Print the full agent workflow instructions
All operations accept --json. Configure via AGENT_ARTIFACTS_CONFIG,
AGENT_ARTIFACTS_HOME, or AGENT_ARTIFACTS_PORT. No uploads or telemetry.
`;
function parse(args: string[]) {
	const positions: string[] = [];
	const options = new Map<string, string[]>();
	const flags = new Set<string>();
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;
		if (["--json", "--wait", "--help"].includes(arg)) {
			flags.add(arg);
			continue;
		}
		if (arg.startsWith("--")) {
			if (!["--title", "--description", "--tag", "--output"].includes(arg))
				throw new Error(`Unknown option: ${arg}`);
			const value = args[++i];
			if (!value || value.startsWith("--"))
				throw new Error(`Missing value for ${arg}`);
			options.set(arg, [...(options.get(arg) ?? []), value]);
		} else positions.push(arg);
	}
	return { positions, options, flags };
}
export async function main(args: string[]): Promise<void> {
	const { positions, options, flags } = parse(args);
	const command = positions[0];
	if (!command || flags.has("--help") || command === "help") {
		console.log(HELP);
		return;
	}
	const target = positions[1];
	if (positions.length > 2) throw new Error("Too many arguments");
	const allowed: Record<string, string[]> = {
		init: ["--title"],
		build: [],
		submit: ["--title", "--description", "--tag"],
		list: [],
		status: [],
		export: ["--output"],
		url: [],
		serve: [],
		skill: [],
	};
	if (!Object.hasOwn(allowed, command))
		throw new Error(`Unknown command: ${command}`);
	for (const option of options.keys())
		if (!allowed[command]?.includes(option))
			throw new Error(`${option} is not supported for ${command}`);
	if (flags.has("--wait") && command !== "submit")
		throw new Error("--wait is only supported for submit");
	if (
		["init", "build", "submit", "status", "export"].includes(command) &&
		!target
	)
		throw new Error(`${command} requires a path or artifact ID`);
	if (["serve", "list", "skill"].includes(command) && target)
		throw new Error(`${command} takes no argument`);
	const json = flags.has("--json");
	const emit = (value: unknown, text: string) =>
		console.log(json ? JSON.stringify(value) : text);
	if (command === "skill") {
		const path = fileURLToPath(
			new URL("../resources/skill.md", import.meta.url),
		);
		const skill = await Bun.file(path).text();
		emit({ skill }, skill);
		return;
	}
	if (command === "init") {
		const path = await initProject(
			target as string,
			options.get("--title")?.[0] ?? basename(target as string),
		);
		emit(
			{ path },
			`Created ${path}\nNext: cd into the workspace and run bun install --frozen-lockfile`,
		);
		return;
	}
	if (command === "build") {
		await buildProject(target as string);
		emit(
			{
				path: join(resolve(target as string), "dist/index.html"),
				checked: true,
			},
			`Type-checked and built ${join(resolve(target as string), "dist/index.html")}`,
		);
		return;
	}
	const config = await loadConfig();
	if (command === "submit") {
		const project = resolve(target as string);
		const metadata = await Bun.file(join(project, "artifact.json"))
			.json()
			.catch(() => ({}));
		const manifest = await submit(config, project, {
			title: options.get("--title")?.[0] ?? metadata.title ?? basename(project),
			description:
				options.get("--description")?.[0] ?? metadata.description ?? "",
			tags: options.get("--tag") ?? metadata.tags ?? [],
		});
		if (flags.has("--wait")) {
			const deadline = Date.now() + 10000;
			let current = await status(config, manifest.id);
			while (current.state === "queued" && Date.now() < deadline) {
				await Bun.sleep(100);
				current = await status(config, manifest.id);
			}
			if (current.state !== "published")
				throw new Error(
					`Submission ${manifest.id} is ${current.state}. ${current.error ?? "Start the configured background service; the snapshot remains queued."}`,
				);
		}
		const current = await status(config, manifest.id);
		const url = `${baseUrl(config)}/artifacts/${manifest.id}`;
		emit(
			{ ...manifest, state: current.state, url },
			`${current.state}: ${manifest.id}\n${url}`,
		);
	} else if (command === "list") {
		const artifacts = await list(config);
		emit(
			artifacts,
			artifacts.map((item) => `${item.id}\t${item.title}`).join("\n") ||
				"No published artifacts.",
		);
	} else if (command === "status") {
		const result = await status(config, target as string);
		emit(
			{ id: target, ...result },
			`${target}: ${result.state}${result.error ? `\n${result.error}` : ""}`,
		);
	} else if (command === "export") {
		const output = options.get("--output")?.[0];
		if (!output) throw new Error("export requires --output <file.zip>");
		// Never silently overwrite an existing export.
		const { open } = await import("node:fs/promises");
		const data = await archive(config, target as string);
		const file = await open(resolve(output), "wx", 0o600);
		try {
			await file.writeFile(data);
		} finally {
			await file.close();
		}
		emit({ path: resolve(output), bytes: data.length }, resolve(output));
	} else if (command === "url") {
		if (target) assertId(target);
		const url = baseUrl(config) + (target ? `/artifacts/${target}` : "/");
		emit({ url }, url);
	} else if (command === "serve") {
		const server = await startServer(config);
		emit(
			{ url: server.url, dataDir: config.dataDir },
			`Hosting ${server.url}\nStore: ${config.dataDir}`,
		);
		let shuttingDown = false;
		const shutdown = async () => {
			if (shuttingDown) return;
			shuttingDown = true;
			await server.stop();
			process.exit(0);
		};
		process.once("SIGTERM", shutdown);
		process.once("SIGINT", shutdown);
	}
}
