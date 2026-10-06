module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: Object.fromEntries(
				["background", "foreground", "border", "input", "ring"]
					.map((name) => [name, `hsl(var(--${name}))`])
					.concat(
						[
							"primary",
							"secondary",
							"destructive",
							"muted",
							"accent",
							"popover",
							"card",
						].map((name) => [
							name,
							{
								DEFAULT: `hsl(var(--${name}))`,
								foreground: `hsl(var(--${name}-foreground))`,
							},
						]),
					),
			),
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
