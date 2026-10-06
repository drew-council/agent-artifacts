#!/usr/bin/env bun
import { main } from "./src/cli.ts";

// Standard CLI behavior: a closed downstream pipe (for example `| head`) is not an error.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
	if (error.code === "EPIPE") process.exit(0);
	throw error;
});

if (import.meta.main) {
	try {
		await main(process.argv.slice(2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
