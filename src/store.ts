import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.ts";
import {
	assertId,
	copySource,
	digest,
	MAX_SOURCE_BYTES,
	readLimited,
	scanSource,
	slugify,
	sourceHash,
} from "./files.ts";
import { offlineDocument } from "./offline.ts";
import { type ZipFile, zip } from "./zip.ts";

export interface Manifest {
	version: 1;
	id: string;
	title: string;
	description: string;
	tags: string[];
	createdAt: string;
	htmlHash: string;
	sourceHash: string;
}
export interface Receipt {
	version: 1;
	htmlHash: string;
	sourceHash: string;
}

export async function ensureStore(config: Config): Promise<void> {
	await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
	if ((await lstat(config.dataDir)).isSymbolicLink())
		throw new Error("Store must not be a symlink");
	for (const part of ["inbox", "artifacts", "failed", "staging"]) {
		const dir = join(config.dataDir, part);
		await mkdir(dir, { recursive: true, mode: 0o700 });
		const stat = await lstat(dir);
		if (stat.isSymbolicLink() || !stat.isDirectory())
			throw new Error("Invalid store directory");
	}
}
function validateReceipt(value: unknown): asserts value is Receipt {
	if (!value || typeof value !== "object")
		throw new Error("Missing build receipt; run agent-artifacts build");
	const receipt = value as Receipt;
	if (
		receipt.version !== 1 ||
		!/^[a-f0-9]{64}$/.test(receipt.htmlHash) ||
		!/^[a-f0-9]{64}$/.test(receipt.sourceHash)
	)
		throw new Error("Invalid build receipt");
}
export function validateManifest(value: unknown): asserts value is Manifest {
	validateReceipt(value);
	const manifest = value as Manifest;
	assertId(manifest.id);
	if (
		typeof manifest.title !== "string" ||
		!manifest.title.trim() ||
		manifest.title.length > 200
	)
		throw new Error("Invalid title (1–200 characters)");
	if (
		typeof manifest.description !== "string" ||
		manifest.description.length > 2000
	)
		throw new Error("Invalid description");
	if (
		!Array.isArray(manifest.tags) ||
		manifest.tags.length > 16 ||
		manifest.tags.some(
			(tag) => typeof tag !== "string" || !tag.trim() || tag.length > 80,
		)
	)
		throw new Error("Invalid tags");
	if (
		typeof manifest.createdAt !== "string" ||
		!Number.isFinite(Date.parse(manifest.createdAt))
	)
		throw new Error("Invalid submission date");
}
export async function validateBundle(
	directory: string,
	expectedId?: string,
): Promise<Manifest> {
	const stat = await lstat(directory);
	if (!stat.isDirectory() || stat.isSymbolicLink())
		throw new Error("Invalid artifact directory");
	const manifest = JSON.parse(
		new TextDecoder().decode(
			await readLimited(join(directory, "manifest.json"), 65536),
		),
	);
	validateManifest(manifest);
	if (expectedId && manifest.id !== expectedId)
		throw new Error("Artifact ID mismatch");
	const html = await readLimited(join(directory, "index.html"));
	if (digest(html) !== manifest.htmlHash)
		throw new Error("HTML integrity check failed");
	await offlineDocument(new TextDecoder().decode(html));
	await scanSource(join(directory, "source"), true);
	if ((await sourceHash(join(directory, "source"))) !== manifest.sourceHash)
		throw new Error("Source integrity check failed");
	return manifest;
}
export async function submit(
	config: Config,
	project: string,
	options: { title: string; description?: string; tags?: string[] },
): Promise<Manifest> {
	await ensureStore(config);
	const receipt = JSON.parse(
		new TextDecoder().decode(
			await readLimited(join(project, "dist", "build-receipt.json"), 65536),
		),
	);
	validateReceipt(receipt);
	const html = await readLimited(join(project, "dist", "index.html"));
	if (
		digest(html) !== receipt.htmlHash ||
		(await sourceHash(project)) !== receipt.sourceHash
	)
		throw new Error(
			"Build is stale or modified; run agent-artifacts build again",
		);
	await offlineDocument(new TextDecoder().decode(html));
	const id = `${slugify(options.title)}-${randomUUID()}`;
	const manifest: Manifest = {
		version: 1,
		id,
		title: options.title.trim(),
		description: options.description ?? "",
		tags: [...new Set(options.tags ?? [])],
		createdAt: new Date().toISOString(),
		htmlHash: receipt.htmlHash,
		sourceHash: receipt.sourceHash,
	};
	validateManifest(manifest);
	const stage = join(config.dataDir, "staging", id);
	await mkdir(stage, { mode: 0o700 });
	try {
		await copySource(project, join(stage, "source"));
		await Bun.write(join(stage, "index.html"), html);
		await Bun.write(
			join(stage, "manifest.json"),
			JSON.stringify(manifest, null, 2),
		);
		await validateBundle(stage, id); // detect edits while copying; publish complete snapshots only
		await rename(stage, join(config.dataDir, "inbox", id));
		return manifest;
	} finally {
		await rm(stage, { recursive: true, force: true });
	}
}
export async function ingest(
	config: Config,
): Promise<{ imported: string[]; failed: string[] }> {
	await ensureStore(config);
	const result: { imported: string[]; failed: string[] } = {
		imported: [],
		failed: [],
	};
	for (const entry of await readdir(join(config.dataDir, "inbox"), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,120}$/.test(entry.name))
			continue;
		const source = join(config.dataDir, "inbox", entry.name);
		try {
			await validateBundle(source, entry.name);
			const target = join(config.dataDir, "artifacts", entry.name);
			if (await Bun.file(join(target, "manifest.json")).exists())
				throw new Error("Artifact ID already exists");
			await rename(source, target);
			result.imported.push(entry.name);
		} catch (error) {
			const destination = join(config.dataDir, "failed", entry.name);
			// Never overwrite a previous quarantine; malformed bundles cannot stop other submissions.
			try {
				await rename(source, destination);
				await Bun.write(join(destination, "error.txt"), String(error));
			} catch (quarantineError) {
				console.error(
					"Cannot quarantine submission:",
					entry.name,
					quarantineError,
				);
			}
			result.failed.push(entry.name);
			console.error("Rejected submission:", entry.name, String(error));
		}
	}
	return result;
}
export async function list(config: Config): Promise<Manifest[]> {
	await ensureStore(config);
	const output: Manifest[] = [];
	for (const entry of await readdir(join(config.dataDir, "artifacts"), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory()) continue;
		try {
			assertId(entry.name);
			const manifest = JSON.parse(
				new TextDecoder().decode(
					await readLimited(
						join(config.dataDir, "artifacts", entry.name, "manifest.json"),
						65536,
					),
				),
			);
			validateManifest(manifest);
			if (manifest.id !== entry.name) throw new Error("ID mismatch");
			output.push(manifest);
		} catch (error) {
			console.error("Invalid stored metadata:", entry.name, String(error));
		}
	}
	return output.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function status(
	config: Config,
	id: string,
): Promise<{
	state: "queued" | "published" | "failed" | "missing";
	error?: string;
}> {
	assertId(id);
	for (const [directory, state] of [
		["artifacts", "published"],
		["inbox", "queued"],
		["failed", "failed"],
	] as const) {
		if (
			await Bun.file(
				join(config.dataDir, directory, id, "manifest.json"),
			).exists()
		) {
			return {
				state,
				...(state === "failed"
					? {
							error: await Bun.file(
								join(config.dataDir, directory, id, "error.txt"),
							)
								.text()
								.catch(() => "Unknown ingestion error"),
						}
					: {}),
			};
		}
	}
	return { state: "missing" };
}
export async function archive(config: Config, id: string): Promise<Uint8Array> {
	assertId(id);
	const root = join(config.dataDir, "artifacts", id);
	const manifest = await validateBundle(root, id);
	const encoder = new TextEncoder();
	const instructions = `# ${manifest.title}\n\nOpen index.html in a browser. All runtime dependencies are embedded; no server, installation, internet access, or agent account is required.\n\nTo edit: install Bun (or Node + npm), enter source/, run bun install --frozen-lockfile, then bun run dev. Type-check with bun run typecheck; rebuild with bun run build. Dependency installation may download packages, but never uploads artifact content.\n\nNetwork requests are blocked by the HTML's Content Security Policy. Navigation should use hash routing. The hosted preview has isolated browser storage; do not depend on localStorage.\n\nSource is included; review it before distributing sensitive material. This archive contains executable JavaScript: inspect unfamiliar artifacts before opening them.\n`;
	const files: ZipFile[] = [
		{ name: "index.html", data: await readLimited(join(root, "index.html")) },
		{ name: "README.txt", data: encoder.encode(instructions) },
		{
			name: "artifact.json",
			data: encoder.encode(JSON.stringify(manifest, null, 2)),
		},
	];
	for (const path of await scanSource(join(root, "source"), true)) {
		files.push({
			name: `source/${path}`,
			data: await readLimited(join(root, "source", path), MAX_SOURCE_BYTES),
		});
	}
	return zip(files);
}
