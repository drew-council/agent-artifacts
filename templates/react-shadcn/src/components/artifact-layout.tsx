import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ArtifactLayout({
	title,
	subtitle,
	eyebrow,
	children,
}: {
	title: string;
	subtitle?: string;
	eyebrow?: string;
	children: ReactNode;
}) {
	return (
		<main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8 sm:py-14">
			<header className="max-w-3xl space-y-3">
				{eyebrow && (
					<p className="text-sm font-medium text-primary">{eyebrow}</p>
				)}
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
					{title}
				</h1>
				{subtitle && (
					<p className="text-lg text-muted-foreground">{subtitle}</p>
				)}
			</header>
			{children}
		</main>
	);
}
export function Metric({
	label,
	value,
	detail,
}: {
	label: string;
	value: ReactNode;
	detail?: string;
}) {
	return (
		<Card>
			<CardContent className="space-y-2 p-6">
				<p className="text-sm text-muted-foreground">{label}</p>
				<p className="text-3xl font-semibold tabular-nums">{value}</p>
				{detail && <p className="text-sm text-muted-foreground">{detail}</p>}
			</CardContent>
		</Card>
	);
}
export function Note({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<aside
			className={cn(
				"rounded-md border border-primary/20 bg-primary/5 px-5 py-4 text-sm",
				className,
			)}
		>
			{children}
		</aside>
	);
}
