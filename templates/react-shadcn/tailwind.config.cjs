const { fontFamily } = require("tailwindcss/defaultTheme");

const catppuccin = [
	"rosewater",
	"flamingo",
	"pink",
	"mauve",
	"red",
	"maroon",
	"peach",
	"yellow",
	"green",
	"teal",
	"sky",
	"sapphire",
	"blue",
	"lavender",
	"text",
	"subtext1",
	"subtext0",
	"overlay2",
	"overlay1",
	"overlay0",
	"surface2",
	"surface1",
	"surface0",
	"base",
	"mantle",
	"crust",
];

module.exports = {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Noto Sans Variable"', '"Noto Sans"', ...fontFamily.sans],
				mono: [
					'"JetBrains Mono Variable"',
					'"JetBrains Mono"',
					...fontFamily.mono,
				],
			},
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
					)
					.concat([
						[
							"ctp",
							Object.fromEntries(
								catppuccin.map((name) => [name, `hsl(var(--ctp-${name}))`]),
							),
						],
					]),
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
