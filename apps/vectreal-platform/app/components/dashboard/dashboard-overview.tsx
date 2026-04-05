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
		<div className="bg-muted/30 hover:bg-muted/40 rounded-2xl p-5 transition-colors duration-200">
			<p className="text-muted-foreground text-sm tracking-tight">{label}</p>
			<p className="text-accent! mt-2 text-3xl font-semibold tracking-tight">
				{value}
			</p>
			<p className="text-muted-foreground mt-2 text-xs">{helpText}</p>
		</div>
	)
}

export function DashboardOverview({ kpis }: DashboardOverviewProps) {
	const publishedRatio = formatRatio(kpis.publishedScenes, kpis.totalScenes)
	const draftRatio = formatRatio(kpis.draftScenes, kpis.totalScenes)

	return (
		<div className="space-y-6">
			<section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
			</section>
		</div>
	)
}
