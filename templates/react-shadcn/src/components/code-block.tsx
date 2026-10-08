import asm from "@shikijs/langs/asm";
import bash from "@shikijs/langs/bash";
import c from "@shikijs/langs/c";
import cpp from "@shikijs/langs/cpp";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import docker from "@shikijs/langs/docker";
import go from "@shikijs/langs/go";
import html from "@shikijs/langs/html";
import ini from "@shikijs/langs/ini";
import javascript from "@shikijs/langs/javascript";
import jinja from "@shikijs/langs/jinja";
import json from "@shikijs/langs/json";
import kdl from "@shikijs/langs/kdl";
import lua from "@shikijs/langs/lua";
import make from "@shikijs/langs/make";
import markdown from "@shikijs/langs/markdown";
import nix from "@shikijs/langs/nix";
import nushell from "@shikijs/langs/nushell";
import odin from "@shikijs/langs/odin";
import python from "@shikijs/langs/python";
import ron from "@shikijs/langs/ron";
import rust from "@shikijs/langs/rust";
import svelte from "@shikijs/langs/svelte";
import templ from "@shikijs/langs/templ";
import toml from "@shikijs/langs/toml";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import typst from "@shikijs/langs/typst";
import verilog from "@shikijs/langs/verilog";
import xml from "@shikijs/langs/xml";
import yaml from "@shikijs/langs/yaml";
import zig from "@shikijs/langs/zig";
import catppuccinMocha from "@shikijs/themes/catppuccin-mocha";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { cn } from "@/lib/utils";

// Grammars are bundled into the artifact only when CodeBlock is imported.
// Add more from @shikijs/langs/<name> as needed; unknown languages render as plain text.
const highlighter = createHighlighterCoreSync({
	themes: [catppuccinMocha],
	langs: [
		asm,
		bash,
		c,
		cpp,
		css,
		diff,
		docker,
		go,
		html,
		ini,
		javascript,
		jinja,
		json,
		kdl,
		lua,
		make,
		markdown,
		nix,
		nushell,
		odin,
		python,
		ron,
		rust,
		svelte,
		templ,
		toml,
		tsx,
		typescript,
		typst,
		verilog,
		xml,
		yaml,
		zig,
	],
	langAlias: { jsx: "tsx" },
	engine: createJavaScriptRegexEngine(),
});

function tokenStyle(color?: string, fontStyle = 0): CSSProperties {
	// Bit flags from TextMate: italic 1, bold 2, underline 4, strikethrough 8.
	const decoration = [
		fontStyle & 4 ? "underline" : "",
		fontStyle & 8 ? "line-through" : "",
	]
		.filter(Boolean)
		.join(" ");
	return {
		color,
		fontStyle: fontStyle & 1 ? "italic" : undefined,
		fontWeight: fontStyle & 2 ? "bold" : undefined,
		textDecoration: decoration || undefined,
	};
}

export function CodeBlock({
	code,
	language = "text",
	title,
	className,
}: {
	code: string;
	language?: string;
	title?: string;
	className?: string;
}) {
	const { tokens, bg, fg } = useMemo(() => {
		const lang = highlighter.getLoadedLanguages().includes(language)
			? language
			: "text";
		return highlighter.codeToTokens(code.replace(/\n$/, ""), {
			lang,
			theme: "catppuccin-mocha",
		});
	}, [code, language]);
	return (
		<figure
			className={cn("overflow-hidden rounded-md border text-sm", className)}
			style={{ backgroundColor: bg, color: fg }}
		>
			{title && (
				<figcaption className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
					{title}
				</figcaption>
			)}
			<pre className="overflow-x-auto p-4 font-mono leading-relaxed">
				<code>
					{tokens.map((line, row) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
						<span key={row} className="block min-h-[1lh]">
							{line.map((token, column) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional
									key={column}
									style={tokenStyle(token.color, token.fontStyle)}
								>
									{token.content}
								</span>
							))}
						</span>
					))}
				</code>
			</pre>
		</figure>
	);
}
