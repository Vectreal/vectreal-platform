import { Button } from '@shared/components/ui/button'
import { AlertCircle, ArrowLeft, BookOpen } from 'lucide-react'
import { data, Link } from 'react-router'

export function loader() {
	return data(null, { status: 404 })
}

export default function DocsNotFoundPage() {
	return (
		<div className="flex min-h-[40vh] items-center justify-center px-2 py-12">
			<div className="w-full max-w-2xl rounded-2xl border p-8">
				<div className="mb-5 flex items-center gap-3">
					<div className="bg-destructive/10 rounded-full p-2">
						<AlertCircle
							className="text-destructive h-5 w-5"
							aria-hidden="true"
						/>
					</div>
					<p className="text-muted-foreground text-sm font-medium">Error 404</p>
				</div>

				<h1 className="text-foreground text-2xl font-semibold tracking-tight">
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
					<Button asChild variant="outline">
						<Link to="/docs/getting-started" viewTransition>
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
							Getting Started
						</Link>
					</Button>
				</div>

				<div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
					<Link
						to="/docs/guides/upload"
						viewTransition
						className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-2 transition-colors"
					>
						Guides: Upload
					</Link>
					<Link
						to="/docs/guides/optimize"
						viewTransition
						className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-2 transition-colors"
					>
						Guides: Optimize
					</Link>
					<Link
						to="/docs/guides/publish-embed"
						viewTransition
						className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-2 transition-colors"
					>
						Guides: Publish and Embed
					</Link>
					<Link
						to="/docs/packages/viewer"
						viewTransition
						className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border px-3 py-2 transition-colors"
					>
						Package Reference
					</Link>
				</div>
			</div>
		</div>
	)
}
