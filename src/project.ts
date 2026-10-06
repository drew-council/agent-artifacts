import { randomUUID } from "node:crypto";
import { chmod, copyFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, readLimited, sourceHash } from "./files.ts";
import { offlineDocument } from "./offline.ts";

const templateDir =
	process.env.AGENT_ARTIFACTS_TEMPLATE ??
	fileURLToPath(new URL("../templates/react-shadcn", import.meta.url));
async function copyTemplate(source: string, target: string): Promise<void> {
	await mkdir(target, { recursive: true, mode: 0o755 });
	for (const entry of await readdir(source, { withFileTypes: true })) {
		if (["node_modules", "dist"].includes(entry.name)) continue;
		if (entry.isSymbolicLink())
			throw new Error("Template symlinks are not supported");
		if (entry.isDirectory())
			await copyTemplate(join(source, entry.name), join(target, entry.name));
		else if (entry.isFile()) {
			await copyFile(join(source, entry.name), join(target, entry.name));
			await chmod(join(target, entry.name), 0o644);
		} else throw new Error("Unsupported template entry");
	}
}
export async function initProject(
	path: string,
	title: string,
): Promise<string> {
	const target = resolve(path);
	if (!title.trim() || title.length > 200)
		throw new Error("Title must contain 1–200 characters");
	await mkdir(dirname(target), { recursive: true });
	// Never merge a scaffold into existing work.
	await mkdir(target);
	try {
		await copyTemplate(templateDir, target);
		await Bun.write(
			join(target, "artifact.json"),
			JSON.stringify({ title, description: "", tags: [] }, null, 2),
		);
		const html = await Bun.file(join(target, "index.html")).text();
		const escaped = title
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
		await Bun.write(
			join(target, "index.html"),
			html.replace("Artifact workspace", escaped),
		);
		return target;
	} catch (error) {
		await rm(target, { recursive: true, force: true });
		throw error;
	}
}
export async function run(command: string[], cwd: string): Promise<void> {
	const child = Bun.spawn(command, {
		cwd,
		stdin: "inherit",
		stdout: "pipe",
		stderr: "inherit",
		env: { ...process.env, DO_NOT_TRACK: "1" },
	});
	for await (const chunk of child.stdout) process.stderr.write(chunk);
	if ((await child.exited) !== 0)
		throw new Error(`Command failed: ${command.join(" ")}`);
}
export async function buildProject(path: string): Promise<void> {
	const project = resolve(path);
	const receipt = join(project, "dist", "build-receipt.json");
	await rm(receipt, { force: true });
	const before = await sourceHash(project);
	await run(["bun", "run", "typecheck"], project);
	await run(["bun", "run", "build"], project);
	if ((await sourceHash(project)) !== before)
		throw new Error("Sources changed during build; build again");
	const entries = await readdir(join(project, "dist"));
	if (entries.length !== 1 || entries[0] !== "index.html")
		throw new Error(
			"Build must produce only dist/index.html; import assets from src instead of public/",
		);
	const output = join(project, "dist", "index.html");
	const html = await offlineDocument(
		new TextDecoder().decode(await readLimited(output)),
	);
	const temporary = `${output}.${randomUUID()}.tmp`;
	await Bun.write(temporary, html);
	await rename(temporary, output);
	await Bun.write(
		receipt,
		JSON.stringify(
			{ version: 1, sourceHash: before, htmlHash: digest(html) },
			null,
			2,
		),
	);
}
