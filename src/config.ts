import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface Config {
	dataDir: string;
	port: number;
	pollIntervalMs: number;
}

export async function loadConfig(): Promise<Config> {
	let input: Record<string, unknown> = {};
	if (process.env.AGENT_ARTIFACTS_CONFIG) {
		input = await Bun.file(process.env.AGENT_ARTIFACTS_CONFIG).json();
		if (!input || typeof input !== "object" || Array.isArray(input))
			throw new Error("Invalid configuration");
	}
	const dataDir =
		process.env.AGENT_ARTIFACTS_HOME ??
		input.dataDir ??
		join(homedir(), ".local/share/agent-artifacts");
	const port = process.env.AGENT_ARTIFACTS_PORT
		? Number(process.env.AGENT_ARTIFACTS_PORT)
		: (input.port ?? 41780);
	const pollIntervalMs = input.pollIntervalMs ?? 1000;
	if (typeof dataDir !== "string" || !dataDir)
		throw new Error("dataDir must be a path");
	if (
		typeof port !== "number" ||
		!Number.isInteger(port) ||
		port < 1 ||
		port > 65535
	)
		throw new Error("Invalid port");
	if (
		typeof pollIntervalMs !== "number" ||
		!Number.isInteger(pollIntervalMs) ||
		pollIntervalMs < 100
	)
		throw new Error("Invalid pollIntervalMs");
	return { dataDir: resolve(dataDir), port, pollIntervalMs };
}

export function baseUrl(config: Config): string {
	return `http://127.0.0.1:${config.port}`;
}
