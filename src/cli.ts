import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { baseUrl, loadConfig } from "./config.ts";
import { assertId } from "./files.ts";
import { buildProject, initProject } from "./project.ts";
import { startServer } from "./server.ts";
import { archive, list, status, submit } from "./store.ts";

function emit(command: Command, value: unknown, text: string): void {
	console.log(command.optsWithGlobals().json ? JSON.stringify(value) : text);
}

const JSON_OPTION = ["-j, --json", "output machine-readable JSON"] as const;

export async function main(args: string[]): Promise<void> {
	const program = new Command()
		.name("agent-artifacts")
		.description("Build and publish local, offline React/TypeScript artifacts.")
		.version("0.1.0")
		.option("-j, --json", "output machine-readable JSON")
		.showHelpAfterError()
		.exitOverride()
		.addHelpText(
			"after",
			`
Examples:
  agent-artifacts init ./report --title "Quarterly report"
  agent-artifacts build ./report
  agent-artifacts submit ./report --tag research --wait
  agent-artifacts export <id> --output report.zip

Configuration:
  AGENT_ARTIFACTS_CONFIG  Path to the host/CLI JSON configuration
  AGENT_ARTIFACTS_HOME    Override the local artifact storage directory
  AGENT_ARTIFACTS_PORT    Override the loopback HTTP port

All content stays local. No uploads or telemetry.`,
		);

	program
		.command("init")
		.description(
			"Create a React/TypeScript/shadcn workspace without installing dependencies",
		)
		.argument("<directory>", "new workspace directory (must not already exist)")
		.option(
			"--title <title>",
			"artifact title (defaults to the directory name)",
		)
		.action(
			async (
				directory: string,
				options: { title?: string },
				command: Command,
			) => {
				const path = await initProject(
					directory,
					options.title ?? basename(directory),
				);
				emit(
					command,
					{ path },
					`Created ${path}\nNext: cd into the workspace and run bun install --frozen-lockfile`,
				);
			},
		);

	program
		.command("build")
		.description(
			"Type-check and bundle a workspace into verified, offline HTML",
		)
		.argument("<directory>", "artifact workspace directory")
		.action(async (directory: string, _options: unknown, command: Command) => {
			await buildProject(directory);
			const path = join(resolve(directory), "dist/index.html");
			emit(command, { path, checked: true }, `Type-checked and built ${path}`);
		});

	program
		.command("submit")
		.description(
			"Queue an immutable snapshot for the background host to publish",
		)
		.argument(
			"<directory>",
			"artifact workspace with a current, verified build",
		)
		.option("--title <title>", "override the title from artifact.json")
		.option(
			"--description <description>",
			"override the description from artifact.json",
		)
		.option(
			"-t, --tag <tag>",
			"artifact tag; may be repeated (overrides artifact.json)",
			(tag: string, tags: string[]) => [...tags, tag],
		)
		.option(
			"-w, --wait",
			"wait up to 10 seconds for the host to publish the snapshot",
		)
		.action(
			async (
				directory: string,
				options: {
					title?: string;
					description?: string;
					tag?: string[];
					wait?: boolean;
				},
				command: Command,
			) => {
				const config = await loadConfig();
				const project = resolve(directory);
				const metadata = await Bun.file(join(project, "artifact.json"))
					.json()
					.catch(() => ({}));
				const manifest = await submit(config, project, {
					title: options.title ?? metadata.title ?? basename(project),
					description: options.description ?? metadata.description ?? "",
					tags: options.tag ?? metadata.tags ?? [],
				});
				if (options.wait) {
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
					command,
					{ ...manifest, state: current.state, url },
					`${current.state}: ${manifest.id}\n${url}`,
				);
			},
		);

	program
		.command("list")
		.description("List published artifacts")
		.action(async (_options: unknown, command: Command) => {
			const artifacts = await list(await loadConfig());
			emit(
				command,
				artifacts,
				artifacts.map((item) => `${item.id}\t${item.title}`).join("\n") ||
					"No published artifacts.",
			);
		});

	program
		.command("status")
		.description(
			"Inspect whether a submission is queued, published, or rejected",
		)
		.argument("<id>", "artifact ID returned by submit")
		.action(async (id: string, _options: unknown, command: Command) => {
			const result = await status(await loadConfig(), id);
			emit(
				command,
				{ id, ...result },
				`${id}: ${result.state}${result.error ? `\n${result.error}` : ""}`,
			);
		});

	program
		.command("export")
		.description("Export standalone offline HTML and editable source as a ZIP")
		.argument("<id>", "published artifact ID")
		.requiredOption(
			"-o, --output <file.zip>",
			"destination archive (must not already exist)",
		)
		.action(
			async (id: string, options: { output: string }, command: Command) => {
				const { open } = await import("node:fs/promises");
				const data = await archive(await loadConfig(), id);
				const path = resolve(options.output);
				const file = await open(path, "wx", 0o600);
				try {
					await file.writeFile(data);
				} finally {
					await file.close();
				}
				emit(command, { path, bytes: data.length }, path);
			},
		);

	program
		.command("url")
		.description("Print the gallery URL or the URL of an artifact")
		.argument("[id]", "artifact ID (omit to open the gallery)")
		.action(
			async (id: string | undefined, _options: unknown, command: Command) => {
				if (id) assertId(id);
				const url =
					baseUrl(await loadConfig()) + (id ? `/artifacts/${id}` : "/");
				emit(command, { url }, url);
			},
		);

	program
		.command("serve")
		.description("Run the loopback HTTP host and background inbox ingestion")
		.action(async (_options: unknown, command: Command) => {
			const config = await loadConfig();
			const server = await startServer(config);
			emit(
				command,
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
		});

	program
		.command("skill")
		.description(
			"Print the complete agent workflow, component guidance, and safety rules",
		)
		.action(async (_options: unknown, command: Command) => {
			const path = fileURLToPath(
				new URL("../resources/skill.md", import.meta.url),
			);
			const skill = await Bun.file(path).text();
			emit(command, { skill }, skill);
		});

	// Global flags may appear before or after the subcommand.
	for (const command of program.commands) command.option(...JSON_OPTION);

	if (!args.length) {
		program.outputHelp();
		return;
	}
	try {
		await program.parseAsync(args, { from: "user" });
	} catch (error) {
		// Commander has already printed parser errors/help. Do not print them twice.
		if (!(error instanceof CommanderError)) throw error;
		if (error.exitCode !== 0) process.exitCode = error.exitCode;
	}
}
