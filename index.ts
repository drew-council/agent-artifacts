#!/usr/bin/env bun
import { main } from "./src/cli.ts";

if (import.meta.main) {
	try {
		await main(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
