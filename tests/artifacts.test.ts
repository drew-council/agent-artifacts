import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../src/config.ts";
import { assertId, digest, scanSource, sourceHash } from "../src/files.ts";
import { OFFLINE_CSP, offlineDocument } from "../src/offline.ts";
import { initProject } from "../src/project.ts";
import { acquireLock, handleRequest, startServer } from "../src/server.ts";
import { archive, ingest, list, status, submit } from "../src/store.ts";
import { zip } from "../src/zip.ts";

const scratch = join(
	process.env.TEST_TMPDIR ?? tmpdir(),
	`agent-artifacts-test-${randomUUID()}`,
);
beforeAll(() => mkdir(scratch, { recursive: true }));
afterAll(() => rm(scratch, { recursive: true, force: true }));
const html =
	"<!doctype html><html lang='en'><head><title>Test</title></head><body><div id='root'>Offline</div><script>window.test=1</script></body></html>";
async function fixture() {
	const root = join(scratch, randomUUID());
	const project = join(root, "project");
	const config: Config = {
		dataDir: join(root, "store"),
		port: 41781,
		pollIntervalMs: 100,
	};
	await mkdir(join(project, "src"), { recursive: true });
	await mkdir(join(project, "dist"));
	await Bun.write(join(project, "package.json"), '{"name":"test"}');
	await Bun.write(
		join(project, "src", "App.tsx"),
		"export const App=()=>null;",
	);
	const output = await offlineDocument(html);
	await Bun.write(join(project, "dist", "index.html"), output);
	await Bun.write(
		join(project, "dist", "build-receipt.json"),
		JSON.stringify({
			version: 1,
			sourceHash: await sourceHash(project),
			htmlHash: digest(output),
		}),
	);
	return { config, project };
}
describe("offline policy", () => {
	test("inline app has a restrictive CSP, including in exported files", async () => {
		const output = await offlineDocument(html);
		expect(output).toContain(OFFLINE_CSP);
		expect(output.indexOf("Content-Security-Policy")).toBeLessThan(
			output.indexOf("<script>"),
		);
	});
	test.each([
		"<script src='https://cdn.example.com/app.js'></script>",
		"<img src='/image.png'>",
		"<link rel='stylesheet' href='https://example.com/style.css'>",
		"<iframe srcdoc='<p>Nested</p>'></iframe>",
		"<meta http-equiv='refresh' content='0;url=https://example.com'>",
		"<style>body{background:url(https://example.com/a.png)}</style>",
		"<style>@import 'https://example.com/a.css';</style>",
	])("rejects unbundled or forbidden content %s", async (content) => {
		await expect(
			offlineDocument(html.replace("</head>", `${content}</head>`)),
		).rejects.toThrow();
	});
	test("embedded assets and user-initiated citation links are supported", async () => {
		await expect(
			offlineDocument(
				html.replace(
					"</body>",
					"<img src='data:image/png;base64,AA=='><a href='https://example.com'>Source</a></body>",
				),
			),
		).resolves.toContain("data:image/png");
	});
});
test("submission is atomic, snapshots survive source deletion, and host picks up queued work", async () => {
	const { project, config } = await fixture();
	const manifest = await submit(config, project, {
		title: "Test artifact",
		tags: ["research"],
	});
	expect(await status(config, manifest.id)).toEqual({ state: "queued" });
	expect(await list(config)).toEqual([]);
	await rm(project, { recursive: true });
	expect((await ingest(config)).imported).toEqual([manifest.id]);
	expect((await list(config))[0]?.title).toBe("Test artifact");
	expect(await status(config, manifest.id)).toEqual({ state: "published" });
	const bytes = await archive(config, manifest.id);
	const file = join(scratch, `${manifest.id}.zip`);
	await Bun.write(file, bytes);
	// Independent ZIP reader verifies headers, CRC, source paths, and runnable output.
	const proc = Bun.spawn(
		[
			"python3",
			"-c",
			"import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert 'source/src/App.tsx' in z.namelist(); assert 'connect-src' in z.read('index.html').decode(); assert not any('.env' in n for n in z.namelist())",
			file,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const code = await proc.exited;
	expect(await new Response(proc.stderr).text()).toBe("");
	expect(code).toBe(0);
});
test("rejects stale source and tampered build", async () => {
	const { project, config } = await fixture();
	await Bun.write(join(project, "src", "App.tsx"), "changed");
	await expect(submit(config, project, { title: "Stale" })).rejects.toThrow(
		"stale",
	);
	const second = await fixture();
	await Bun.write(join(second.project, "dist", "index.html"), "tampered");
	await expect(
		submit(second.config, second.project, { title: "Tampered" }),
	).rejects.toThrow();
});
test("one invalid inbox item does not stop valid submissions", async () => {
	const { project, config } = await fixture();
	const invalid = await submit(config, project, { title: "Invalid" });
	const valid = await submit(config, project, { title: "Valid" });
	await Bun.write(
		join(config.dataDir, "inbox", invalid.id, "index.html"),
		"tampered",
	);
	const result = await ingest(config);
	expect(result.failed).toEqual([invalid.id]);
	expect(result.imported).toEqual([valid.id]);
	expect((await status(config, invalid.id)).error).toContain("integrity");
});
test("rejects renamed queue identities", async () => {
	const { project, config } = await fixture();
	const manifest = await submit(config, project, { title: "Identity" });
	await rename(
		join(config.dataDir, "inbox", manifest.id),
		join(config.dataDir, "inbox", "different-id"),
	);
	expect((await ingest(config)).failed).toEqual(["different-id"]);
});
test("source selection excludes credentials/dependencies and rejects symlinks", async () => {
	const { project } = await fixture();
	await Bun.write(join(project, ".env"), "SECRET=yes");
	await Bun.write(join(project, "src", "private.key"), "SECRET");
	await mkdir(join(project, "node_modules"));
	await Bun.write(join(project, "node_modules", "secret.txt"), "SECRET");
	expect(await scanSource(project)).toEqual(["package.json", "src/App.tsx"]);
	await symlink(
		join(project, "package.json"),
		join(project, "src", "link.json"),
	);
	await expect(scanSource(project)).rejects.toThrow("Symlinks");
});
test("read-only gallery provides downloads, escaped titles, isolated previews, and no path traversal", async () => {
	const { project, config } = await fixture();
	const manifest = await submit(config, project, {
		title: "<script>Bad title</script>",
	});
	await ingest(config);
	const request = (path: string, method = "GET", host = "127.0.0.1") =>
		handleRequest(
			config,
			new Request(`http://${host}:${config.port}${path}`, { method }),
		);
	const gallery = await request("/");
	expect(await gallery.text()).toContain("Download ZIP");
	const preview = await request(`/artifacts/${manifest.id}`);
	const page = await preview.text();
	expect(page).toContain("&lt;script&gt;");
	expect(page).toContain('sandbox="allow-scripts allow-downloads"');
	const output = await request(`/content/${manifest.id}/index.html`);
	expect(output.headers.get("content-security-policy")).toContain(
		"sandbox allow-scripts",
	);
	expect(output.headers.get("content-security-policy")).toContain(
		"connect-src 'none'",
	);
	const download = await request(`/api/artifacts/${manifest.id}/archive`);
	expect(download.headers.get("content-type")).toBe("application/zip");
	expect(download.headers.get("content-disposition")).toContain(".zip");
	expect((await request("/api/artifacts", "POST")).status).toBe(405);
	expect((await request("/", "GET", "attacker.example")).status).toBe(403);
	expect((await request("/content/%2e%2e%2fsecret/index.html")).status).toBe(
		400,
	);
});
test("duplicate hosts cannot write the same store; stopping releases ownership", async () => {
	const { config } = await fixture();
	const release = await acquireLock(config);
	await expect(acquireLock(config)).rejects.toThrow("Another");
	await release();
	const again = await acquireLock(config);
	await again();
});
test("background service ingests queued work and stops cleanly", async () => {
	const { project, config } = await fixture();
	// Obtain a free port for the actual HTTP integration test.
	const reservation = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch: () => new Response("test"),
	});
	config.port = reservation.port as number;
	await reservation.stop(true);
	const manifest = await submit(config, project, { title: "Background" });
	const host = await startServer(config);
	try {
		const deadline = Date.now() + 2000;
		while (
			(await status(config, manifest.id)).state !== "published" &&
			Date.now() < deadline
		)
			await Bun.sleep(25);
		expect((await fetch(`${host.url}/health`)).status).toBe(200);
		expect((await status(config, manifest.id)).state).toBe("published");
	} finally {
		await host.stop();
	}
	const release = await acquireLock(config);
	await release();
});
test("scaffolding never overwrites existing work", async () => {
	const target = join(scratch, "scaffold");
	await initProject(target, "Typed workspace");
	expect(await Bun.file(join(target, "src", "App.tsx")).exists()).toBe(true);
	expect(await Bun.file(join(target, "bun.lock")).exists()).toBe(true);
	await expect(initProject(target, "Replacement")).rejects.toThrow();
	expect(await Bun.file(join(target, "src", "App.tsx")).exists()).toBe(true);
});
test("skill command works without host configuration and prints packaged guidance", async () => {
	const cli = fileURLToPath(new URL("../index.ts", import.meta.url));
	const expected = await Bun.file(
		new URL("../resources/skill.md", import.meta.url),
	).text();
	const process = Bun.spawn(["bun", cli, "skill", "--json"], {
		env: {
			...Bun.env,
			AGENT_ARTIFACTS_CONFIG: "/nonexistent/artifact-config.json",
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(process.stdout).text();
	expect(await process.exited).toBe(0);
	expect(JSON.parse(output).skill).toBe(expected);
});
test("Home Manager module has no Pi filesystem integration", async () => {
	const module = await Bun.file(
		new URL("../nix/home-manager.nix", import.meta.url),
	).text();
	expect(module).not.toContain(".pi");
	expect(module).not.toContain("home.file");
	expect(module).not.toContain("installPiSkill");
});
test("ZIP and IDs reject traversal", () => {
	expect(() => assertId("../escape")).toThrow();
	expect(() => zip([{ name: "../escape", data: new Uint8Array() }])).toThrow();
});
