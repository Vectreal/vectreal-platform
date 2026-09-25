import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { PublicErrorBoundary } from '../../components/errors'
import { PageHero } from '../../components/layout-components'
import { DOCS_PAGE_COPY } from '../../constants/product-copy'
import {
	DOC_AUDIENCES,
	DOC_CATEGORY_LABELS,
	docsPages,
	type DocCategory
} from '../../lib/docs/docs-manifest'
import { publisherSampleHref } from '../../lib/samples/sample-models'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

export function meta() {
	return buildPageMeta(PUBLIC_SEO_PAGES.docs)
}

/*
  The page's structure is read out of the docs manifest rather than restated.

  It used to hold its own DOCS_SECTIONS array of four categories, which meant
  the landing page and the sidebar were two lists of the same thing and only one
  of them was checked. Deriving it also means a new docs page appears here the
  day it is added to the manifest, which is the only place a contributor is
  told to register one.
*/
const pagesIn = (category: DocCategory) =>
	docsPages
		.filter((page) => page.category === category)
		.sort((a, b) => a.order - b.order)

const quickLinkClass =
	'text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150'

/**
 * One of the manifest's two audiences, as a column of page titles grouped by
 * category in the sidebar's order.
 *
 * Titles only. Each page's description, the sample tiles, the embed snippet and
 * a live viewer all used to sit on this page too, and together they buried the
 * one choice it asks the reader to make. The descriptions open each page.
 *
 * The links state their color: `globals.css` mutes `section li` in
 * `@layer base`, so a link in a list in a section would inherit muted.
 */
function DocsDoor({
	audience,
	start
}: {
	audience: (typeof DOC_AUDIENCES)[number]
	/** The door's quickest way in, under its description. */
	start?: React.ReactNode
}) {
	const headingId = `docs-door-${audience.id}`
	return (
		<section aria-labelledby={headingId}>
			<h2 id={headingId} className="text-h3">
				{audience.label}
			</h2>
			<p className="text-muted-foreground text-body-sm mt-1">
				{audience.description}
			</p>
			{start}

			<div className="mt-10 space-y-8">
				{audience.categories
					.filter((category) => pagesIn(category).length > 0)
					.map((category) => (
						<div key={category}>
							<p className="text-muted-foreground text-eyebrow mb-3">
								{DOC_CATEGORY_LABELS[category]}
							</p>
							<ul className="space-y-2">
								{pagesIn(category).map((page) => (
									<li key={page.slug}>
										<Link
											to={`/docs/${page.slug}`}
											className="text-body text-foreground decoration-orange underline-offset-4 hover:underline"
										>
											{page.title}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
			</div>
		</section>
	)
}

export default function DocsIndexPage() {
	return (
		<main className="bg-background">
			<PageHero
				heading={DOCS_PAGE_COPY.heading}
				description={DOCS_PAGE_COPY.description}
				actions={
					<>
						{/*
						  The publisher first. Most readers of these docs want to try the
						  product, and it needs nothing installed; this button used to be
						  "Start here", and it opened repo setup.
						*/}
						<Button asChild size="sm">
							<Link to="/publisher">
								{DOCS_PAGE_COPY.publisherCta}
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
					</>
				}
			/>

			<div className="container-page pb-32">
				{/*
				  Two doors, from the manifest's audiences, side by side: the reader
				  picks by what they are doing. The page used to offer one "Start
				  here" path that began with contributor setup.
				*/}
				<div className="grid gap-16 md:grid-cols-2">
					{DOC_AUDIENCES.map((audience) => (
						<DocsDoor
							key={audience.id}
							audience={audience}
							start={
								audience.id === 'browser' && (
									/* The publisher with a model already on its way, so there is nothing to hand over first. */
									<Link
										to={publisherSampleHref('rocket')}
										className="text-body-sm text-foreground decoration-orange mt-4 inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
									>
										{DOCS_PAGE_COPY.rocketSampleCta}
										<ArrowRight className="h-3.5 w-3.5" />
									</Link>
								)
							}
						/>
					))}
				</div>

				<div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-2">
					<span className="text-muted-foreground text-eyebrow">
						{DOCS_PAGE_COPY.quickLinksLabel}
					</span>
					<a
						className={quickLinkClass}
						href="https://github.com/Vectreal/vectreal-platform"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<a
						className={quickLinkClass}
						href="https://discord.gg/A9a3nPkZw7"
						target="_blank"
						rel="noopener noreferrer"
					>
						Discord
					</a>
					<Link className={quickLinkClass} to="/changelog">
						Changelog
					</Link>
				</div>
			</div>
		</main>
	)
}

/*
  Without this a throw here reached root.tsx's last-resort fallback, which
  renders the raw error string on a bare document with no nav, no footer and no
  way back - and whose `error` class is defined in no stylesheet.
*/
export { PublicErrorBoundary as ErrorBoundary }
