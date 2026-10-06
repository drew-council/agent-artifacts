// No CDNs, APIs, remote fonts, or subframes. Only embedded scripts/styles/assets.
export const OFFLINE_CSP =
	"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export async function offlineDocument(html: string): Promise<string> {
	if (!/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html))
		throw new Error("Build must produce a complete HTML document");
	const errors: string[] = [];
	const rewriter = new HTMLRewriter().on("*", {
		element(element) {
			const tag = element.tagName;
			for (const name of ["src", "srcset", "poster", "data"]) {
				const value = element.getAttribute(name);
				if (value !== null && !value.startsWith("data:"))
					errors.push(`External/unbundled ${tag} ${name}`);
			}
			if (["iframe", "object", "embed", "base"].includes(tag))
				errors.push(`Unsupported element: ${tag}`);
			if (tag === "link" && element.getAttribute("href") !== null)
				errors.push("Unbundled link asset");
			if (
				tag === "meta" &&
				element.getAttribute("http-equiv")?.toLowerCase() === "refresh"
			)
				errors.push("Meta refresh is not permitted");
			if (
				tag === "meta" &&
				element.getAttribute("http-equiv")?.toLowerCase() ===
					"content-security-policy"
			)
				element.remove();
		},
	});
	html = await rewriter.transform(new Response(html)).text();
	// CSS URLs must be embedded too. User-initiated citation links are not assets.
	for (const match of html.matchAll(/url\(\s*["']?([^)"']+)/gi)) {
		if (
			!match[1]?.trim().startsWith("data:") &&
			!match[1]?.trim().startsWith("#")
		)
			errors.push("Unbundled CSS URL");
	}
	if (/@import\s+(?:url\(|["'])/i.test(html))
		errors.push("CSS imports are not permitted");
	if (errors.length) throw new Error([...new Set(errors)].join("; "));
	return html.replace(
		/<head\b[^>]*>/i,
		(head) =>
			`${head}\n<meta http-equiv="Content-Security-Policy" content="${OFFLINE_CSP}">\n`,
	);
}
