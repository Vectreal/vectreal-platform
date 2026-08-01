import { Button } from '@shared/components/ui/button'
import { AlertCircle, ArrowLeft, BookOpen } from 'lucide-react'
import { data, Link } from 'react-router'

const CANONICAL_PAGES = [
	{ to: '/docs/guides/upload', label: 'Guides: Upload' },
	{ to: '/docs/guides/optimize', label: 'Guides: Optimize' },
	{ to: '/docs/guides/publish-embed', label: 'Guides: Publish and Embed' },
	{ to: '/docs/packages/viewer', label: 'Package Reference' }
]

export function loader() {
	return data(null, { status: 404 })
}

export default function DocsNotFoundPage() {
	return (
		<div className="container-page flex min-h-[50vh] items-center justify-center py-12">
			<div className="ds-raised w-full max-w-2xl rounded-2xl p-8">
				<div className="mb-5 flex items-center gap-3">
					<div className="bg-destructive/10 rounded-full p-2">
						<AlertCircle
							className="text-destructive h-5 w-5"
							aria-hidden="true"
						/>
					</div>
					<p className="text-muted-foreground text-sm font-medium">Error 404</p>
				</div>

				<h1 className="text-foreground text-h3">
					Documentation page not found
				</h1>
				<p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
					This docs URL does not map to a published page yet. Try the docs home
					or jump to one of the canonical guide pages below.
				</p>

				<div className="mt-6 flex flex-wrap gap-3">
					<Button asChild variant="default">
						<Link to="/docs" viewTransition>
							<BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
							Documentation Home
						</Link>
					</Button>
					<Button asChild variant="secondary">
						<Link to="/docs/getting-started" viewTransition>
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
							Getting Started
						</Link>
					</Button>
				</div>

				<div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
					{CANONICAL_PAGES.map((page) => (
						<Link
							key={page.to}
							to={page.to}
							viewTransition
							className="ds-raised-interactive text-muted-foreground hover:text-foreground rounded-xl px-3 py-2"
						>
							{page.label}
						</Link>
					))}
				</div>
			</div>
		</div>
	)
}
