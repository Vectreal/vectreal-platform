import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@shared/components/ui/card'
import { ArrowRight, BookOpen, Code2, GitBranch, Rocket } from 'lucide-react'
import { Link } from 'react-router'

import { BasicCard, PageHero } from '../../components/layout-components'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

export function meta() {
	return buildPageMeta(PUBLIC_SEO_PAGES.docs)
}

const DOCS_SECTIONS = [
	{
		icon: Rocket,
		title: 'Getting Started',
		description:
			'Local setup, prerequisites, and your first 3D model walkthrough.',
		href: '/docs/getting-started'
	},
	{
		icon: BookOpen,
		title: 'Guides',
		description: 'Upload, optimize, publish, and embed 3D content end to end.',
		href: '/docs/guides/upload'
	},
	{
		icon: Code2,
		title: 'Package Reference',
		description: 'API docs for @vctrl/viewer, @vctrl/hooks, and @vctrl/core.',
		href: '/docs/packages/viewer'
	},
	{
		icon: GitBranch,
		title: 'Contributing',
		description: 'Branching model, commit conventions, and PR process.',
		href: '/docs/contributing'
	}
] as const

export default function DocsIndexPage() {
	return (
		<div className="bg-background">
			<PageHero
				eyebrow="Documentation"
				heading="Everything you need to build with Vectreal."
				description="From local dev setup to embedding 3D content in production - platform guides, package APIs, and architecture references."
				actions={
					<>
						<Button asChild size="sm">
							<Link to="/docs/getting-started">
								Get started
								<ArrowRight className="h-3.5 w-3.5" />
							</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<a
								href="https://github.com/Vectreal/vectreal-platform"
								target="_blank"
								rel="noopener noreferrer"
							>
								View on GitHub
							</a>
						</Button>
						<Badge variant="secondary">Open source</Badge>
					</>
				}
			/>

			{/* Section cards */}
			<div className="mx-auto max-w-7xl px-6 pb-20">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{DOCS_SECTIONS.map(({ icon: Icon, title, description, href }) => (
						<Link key={href} to={href} className="group outline-none">
							<BasicCard className="h-full" highlight>
								<CardHeader className="pb-2">
									<div className="bg-accent/10 mb-3 flex h-9 w-9 items-center justify-center rounded-xl">
										<Icon className="text-accent h-4.5 w-4.5" />
									</div>
									<CardTitle className="text-base font-medium">
										{title}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{description}
									</p>
								</CardContent>
							</BasicCard>
						</Link>
					))}
				</div>

				{/* Quick links */}
				<div className="mt-10 flex flex-wrap gap-2">
					<span className="text-muted-foreground self-center text-xs font-medium">
						Quick links
					</span>
					<Button asChild variant="outline" size="sm" className="h-7 text-xs">
						<a
							href="https://github.com/Vectreal/vectreal-platform"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</Button>
					<Button asChild variant="outline" size="sm" className="h-7 text-xs">
						<Link to="/publisher">Open Publisher</Link>
					</Button>
					<Button asChild variant="outline" size="sm" className="h-7 text-xs">
						<a
							href="https://discord.gg/A9a3nPkZw7"
							target="_blank"
							rel="noopener noreferrer"
						>
							Discord
						</a>
					</Button>
					<Button asChild variant="outline" size="sm" className="h-7 text-xs">
						<Link to="/changelog">Changelog</Link>
					</Button>
				</div>
			</div>
		</div>
	)
}
