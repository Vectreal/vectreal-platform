import { Button } from '@shared/components'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

interface DashboardKpis {
	totalProjects: number
	totalScenes: number
	publishedScenes: number
	draftScenes: number
}

interface DashboardOverviewProps {
	kpis: DashboardKpis
}

const formatRatio = (value: number, total: number) => {
	if (total === 0) {
		return '0%'
	}

	return `${Math.round((value / total) * 100)}%`
}

function KpiTile({
	label,
	value,
	helpText
}: {
	label: string
	value: string
	helpText: string
}) {
	return (
		<div className="bg-muted/30 hover:bg-muted/40 flex items-baseline gap-3 rounded-2xl p-5 pb-4 transition-colors duration-200">
			<p className="text-accent! text-3xl leading-6! font-semibold">{value}</p>
			<div className="flex items-center gap-3">
				<p className="text-muted-foreground text-xs">{helpText}</p>
				<p className="text-muted-foreground text-sm tracking-tight">{label}</p>
			</div>
		</div>
	)
}

export function DashboardOverview({ kpis }: DashboardOverviewProps) {
	const publishedRatio = formatRatio(kpis.publishedScenes, kpis.totalScenes)
	const draftRatio = formatRatio(kpis.draftScenes, kpis.totalScenes)

	return (
		<div className="space-y-6">
			<section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[2fr_minmax(400px,1fr)]">
				<div className="grid grid-rows-4 gap-3">
					<KpiTile
						label="Projects"
						value={String(kpis.totalProjects)}
						helpText="Active project containers"
					/>
					<KpiTile
						label="Scenes"
						value={String(kpis.totalScenes)}
						helpText="All scenes across projects"
					/>
					<KpiTile
						label="Published"
						value={String(kpis.publishedScenes)}
						helpText={`${publishedRatio} of all scenes`}
					/>
					<KpiTile
						label="Drafts"
						value={String(kpis.draftScenes)}
						helpText={`${draftRatio} still in progress`}
					/>
				</div>
				<div className="border-muted/50 group relative h-50 w-full overflow-hidden rounded-2xl border md:h-full">
					<div className="h-full opacity-75 blur-[50px]">
						<div className="bg-accent absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2" />
						<div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 bg-white" />
					</div>
					<div className="from-background/75 absolute inset-0 bottom-0 h-full rounded-xl bg-linear-to-t to-transparent opacity-100 transition-opacity duration-500 group-hover:opacity-25" />
					<div className="absolute bottom-0 w-full overflow-clip p-3">
						<Button
							asChild
							className="bg-muted/10 border-primary/10 text-primary group-hover:bg-muted/25! flex h-fit! gap-3 rounded-xl border p-3 text-left whitespace-break-spaces shadow-xl backdrop-blur-2xl transition-colors hover:shadow-2xl"
						>
							<Link
								to="/docs/guides/upload"
								prefetch="intent"
								target="_blank"
								rel="noopener noreferrer"
							>
								<div className="space-y-1">
									<h3 className="text-lg font-medium tracking-tight">
										Learn more about Vectreal
									</h3>
									<p className="text-muted-foreground mt-1 text-sm font-medium tracking-tight">
										Check out our documentation, tutorials, and best practices
										to level up your 3D publishing workflow.
									</p>
								</div>
								<div className="">
									<ChevronRight className="h-4 w-4" />
								</div>
							</Link>
						</Button>
					</div>
				</div>
			</section>
		</div>
	)
}
