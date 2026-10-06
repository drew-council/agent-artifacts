import { useState } from "react";
import { ArtifactLayout, Metric, Note } from "@/components/artifact-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import metadata from "../artifact.json";

export function App() {
	const [count, setCount] = useState(0);
	return (
		<ArtifactLayout
			title={metadata.title}
			subtitle="A local, self-contained React artifact."
			eyebrow="Interactive workspace"
		>
			<Note>
				Replace this demo with the requested deliverable. Keep the shared layout
				and design tokens.
			</Note>
			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="details">Details</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="space-y-6">
					<div className="grid gap-4 md:grid-cols-3">
						<Metric
							label="Interactions"
							value={count}
							detail="React state, running locally"
						/>
						<Metric
							label="Network calls"
							value="0"
							detail="Runtime dependencies are bundled"
						/>
						<Metric
							label="Components"
							value="40+"
							detail="shadcn/ui baseline included"
						/>
					</div>
					<Card>
						<CardHeader>
							<CardTitle>Make something useful</CardTitle>
							<CardDescription>
								Reports, interactive explainers, comparisons, and small tools.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-wrap items-center gap-4">
							<Button onClick={() => setCount((value) => value + 1)}>
								Try interaction
							</Button>
							<Button variant="outline" onClick={() => setCount(0)}>
								Reset
							</Button>
							<Badge variant="secondary">Offline-ready</Badge>
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="details">
					<Card>
						<CardContent className="pt-6">
							Import reusable components from @/components/ui. Use hash routing,
							embedded data, and local file inputs. Do not depend on remote APIs
							or browser storage.
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</ArtifactLayout>
	);
}
