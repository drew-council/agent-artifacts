import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export const MAX_HTML_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 1000;
const rootFiles =
	/^(package\.json|bun\.lock|tsconfig(?:[.-][\w-]+)?\.json|vite\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s|components\.json|index\.html|artifact\.json|README(?:\.[\w-]+)?|LICENSE(?:[.-][\w-]+)?|THIRD_PARTY_NOTICES\.md|\.gitignore)$/;
const sourceDirs = new Set(["src", "public", "scripts"]);
const ignoredDirs = new Set(["node_modules", "dist", "build", ".git"]);
const secretFile =
	/^(\.env(?:\..*)?|\.npmrc|\.netrc|credentials(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|key|p12|pfx)$/i;

export function digest(data: string | Uint8Array): string {
	return createHash("sha256").update(data).digest("hex");
}

export async function scanSource(
	root: string,
	snapshot = false,
): Promise<string[]> {
	const rootStat = await lstat(root);
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
		throw new Error("Source must be a real directory");
	const files: string[] = [];
	let bytes = 0;
	async function walk(relative: string): Promise<void> {
		const entries = await readdir(join(root, relative), {
			withFileTypes: true,
		});
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const path = relative ? `${relative}/${entry.name}` : entry.name;
			if (
				secretFile.test(entry.name) ||
				ignoredDirs.has(entry.name) ||
				(entry.name.startsWith(".") && entry.name !== ".gitignore")
			) {
				if (snapshot) throw new Error(`Disallowed snapshot file: ${path}`);
				continue;
			}
			const stat = await lstat(join(root, path));
			if (stat.isSymbolicLink())
				throw new Error(`Symlinks are not allowed: ${path}`);
			if (
				!relative &&
				!rootFiles.test(entry.name) &&
				!sourceDirs.has(entry.name)
			) {
				if (snapshot) throw new Error(`Unexpected snapshot file: ${path}`);
				continue;
			}
			if (stat.isDirectory()) {
				if (!relative && !sourceDirs.has(entry.name))
					throw new Error(`Invalid source directory: ${path}`);
				await walk(path);
			} else if (stat.isFile()) {
				bytes += stat.size;
				files.push(path);
				if (files.length > MAX_FILES || bytes > MAX_SOURCE_BYTES)
					throw new Error("Source snapshot exceeds size/file limits");
			} else throw new Error(`Special files are not allowed: ${path}`);
		}
	}
	await walk("");
	return files.sort();
}

export async function sourceHash(root: string): Promise<string> {
	const hash = createHash("sha256");
	for (const path of await scanSource(root)) {
		hash.update(path);
		hash.update("\0");
		hash.update(digest(await Bun.file(join(root, path)).bytes()));
		hash.update("\0");
	}
	return hash.digest("hex");
}

export async function copySource(
	source: string,
	target: string,
): Promise<void> {
	await mkdir(target, { recursive: true, mode: 0o700 });
	for (const path of await scanSource(source)) {
		const directory = join(
			target,
			path.slice(0, Math.max(0, path.lastIndexOf("/"))),
		);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		await copyFile(join(source, path), join(target, path));
	}
}

export function slugify(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 60)
			.replace(/-$/g, "") || "artifact"
	);
}

export function assertId(id: string): void {
	if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(id))
		throw new Error("Invalid artifact ID");
}

export async function readLimited(
	path: string,
	max = MAX_HTML_BYTES,
): Promise<Uint8Array> {
	const stat = await lstat(path);
	if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max)
		throw new Error(`Invalid/oversized file: ${basename(path)}`);
	const data = await Bun.file(path).bytes();
	if (data.length > max) throw new Error("File exceeds size limit");
	return data;
}
