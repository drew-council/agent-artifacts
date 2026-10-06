import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { baseUrl } from "./config.ts";
import { assertId, readLimited } from "./files.ts";
import { gallery, preview } from "./gallery.ts";
import { OFFLINE_CSP } from "./offline.ts";
import {
	archive,
	ensureStore,
	ingest,
	list,
	validateManifest,
} from "./store.ts";

const GALLERY_CSP =
	"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function response(
	body: BodyInit | null,
	type: string,
	status = 200,
	extra: Record<string, string> = {},
): Response {
	return new Response(body, {
		status,
		headers: {
			"Content-Type": type,
			"Cache-Control": "no-store",
			"Content-Security-Policy": GALLERY_CSP,
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			...extra,
		},
	});
}
export async function handleRequest(
	config: Config,
	request: Request,
): Promise<Response> {
	const url = new URL(request.url);
	// Reject DNS rebinding; the host never listens on a LAN address.
	if (url.host !== `127.0.0.1:${config.port}`)
		return response("Invalid host", "text/plain", 403);
	if (request.method !== "GET" && request.method !== "HEAD")
		return response("Read-only server", "text/plain", 405, {
			Allow: "GET, HEAD",
		});
	try {
		if (url.pathname === "/")
			return response(gallery(), "text/html; charset=utf-8");
		if (url.pathname === "/health")
			return response(JSON.stringify({ ok: true }), "application/json");
		if (url.pathname === "/api/artifacts") {
			const directories = await Promise.all(
				["inbox", "failed"].map((part) =>
					readdir(join(config.dataDir, part), { withFileTypes: true }),
				),
			);
			return response(
				JSON.stringify({
					artifacts: await list(config),
					queued:
						directories[0]?.filter((entry) => entry.isDirectory()).length ?? 0,
					failed:
						directories[1]?.filter((entry) => entry.isDirectory()).length ?? 0,
				}),
				"application/json",
			);
		}
		const route =
			/^\/(artifacts|content|api\/artifacts)\/([^/]+)(\/index\.html|\/archive)?$/.exec(
				url.pathname,
			);
		if (!route) return response("Not found", "text/plain", 404);
		const [, section, rawId, suffix] = route;
		const id = decodeURIComponent(rawId ?? "");
		assertId(id);
		const directory = join(config.dataDir, "artifacts", id);
		const manifestPath = join(directory, "manifest.json");
		if (!(await Bun.file(manifestPath).exists()))
			return response("Not found", "text/plain", 404);
		const manifest = JSON.parse(
			new TextDecoder().decode(await readLimited(manifestPath, 65536)),
		);
		validateManifest(manifest);
		if (manifest.id !== id) throw new Error("ID mismatch");
		if (section === "artifacts" && !suffix)
			return response(preview(id, manifest.title), "text/html; charset=utf-8");
		if (section === "content" && suffix === "/index.html") {
			const content = await readLimited(join(directory, "index.html"));
			return response(
				new Blob([new Uint8Array(content)]),
				"text/html; charset=utf-8",
				200,
				{
					"Content-Security-Policy": `${OFFLINE_CSP}; sandbox allow-scripts allow-downloads`,
				},
			);
		}
		if (section === "api/artifacts" && suffix === "/archive") {
			return response(
				new Blob([new Uint8Array(await archive(config, id))]),
				"application/zip",
				200,
				{ "Content-Disposition": `attachment; filename="${id}.zip"` },
			);
		}
		return response("Not found", "text/plain", 404);
	} catch (error) {
		console.error("Request failed:", url.pathname, String(error));
		return response("Invalid artifact or request", "text/plain", 400);
	}
}
export async function acquireLock(
	config: Config,
): Promise<() => Promise<void>> {
	await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
	const path = join(config.dataDir, "host.lock");
	const owner = JSON.stringify({ pid: process.pid, token: randomUUID() });
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const file = await open(path, "wx", 0o600);
			await file.writeFile(owner);
			await file.close();
			return async () => {
				if ((await readFile(path, "utf8").catch(() => "")) === owner)
					await unlink(path);
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			const previous = await readFile(path, "utf8");
			let pid: number;
			try {
				pid = JSON.parse(previous).pid;
			} catch {
				throw new Error("Invalid host.lock; inspect it before removing");
			}
			if (!Number.isInteger(pid) || pid <= 0)
				throw new Error("Invalid host lock PID");
			try {
				process.kill(pid, 0);
				throw new Error(`Another artifact host is running (PID ${pid})`);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
				if ((await readFile(path, "utf8")) === previous) await unlink(path);
			}
		}
	}
	throw new Error("Cannot acquire host lock");
}
export async function startServer(
	config: Config,
): Promise<{ url: string; stop: () => Promise<void> }> {
	await ensureStore(config);
	const release = await acquireLock(config);
	let running: Promise<unknown> | null = null;
	let timer: ReturnType<typeof setInterval> | undefined;
	const tick = () => {
		if (!running)
			running = ingest(config)
				.catch((error) => console.error("Ingestion failed:", error))
				.finally(() => {
					running = null;
				});
	};
	try {
		const server = Bun.serve({
			hostname: "127.0.0.1",
			port: config.port,
			fetch: (request) => handleRequest(config, request),
		});
		tick();
		timer = setInterval(tick, config.pollIntervalMs);
		let stopped = false;
		return {
			url: baseUrl(config),
			stop: async () => {
				if (stopped) return;
				stopped = true;
				clearInterval(timer);
				await server.stop(true);
				await running;
				await release();
			},
		};
	} catch (error) {
		clearInterval(timer);
		await release();
		throw error;
	}
}
