import { Button } from '@shared/components/ui/button'
import { cn, formatFileSize } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { Link, type MetaArgs } from 'react-router'

import { PublicErrorBoundary } from '../../components/errors'
import { Band, PageHero, SheetFrame } from '../../components/layout-components'
import { ModelLinkRow } from '../../components/layout-components/model-link-row'
import { routeErrorMeta } from '../../components/not-found'
import { DOCS_PAGE_COPY } from '../../constants/product-copy'
import {
	DOC_AUDIENCES,
	DOC_CATEGORY_LABELS,
	docsPages,
	type DocCategory
} from '../../lib/docs/docs-manifest'
import { COMMUNITY } from '../../lib/navigation/site-map'
import {
	publisherSampleHref,
	requireSampleModel
} from '../../lib/samples/sample-models'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

export function meta({ error }: MetaArgs) {
	if (error) return routeErrorMeta(error)
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
// The sample offered on the artists' path: the one under a megabyte.
const rocket = requireSampleModel('rocket')

const pagesIn = (category: DocCategory) =>
	docsPages
		.filter((page) => page.category === category)
		.sort((a, b) => a.order - b.order)

const quickLinkClass =
	'text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150'

/**
 * One of the manifest's two paths, as a bento: the path's heading and what it
 * needs, then a tile per category holding that category's page titles in the
 * sidebar's order. On a wide screen a path with two categories gives the first,
 * the way in, a third and the second two thirds; a path with three sets them
 * as three equal tiles.
 *
 * Titles only. Each page's description, the sample tiles, the embed snippet and
 * a live viewer all used to sit on this page too, and together they buried the
 * one choice it asks the reader to make. The descriptions open each page.
 *
 * The links state their color: `globals.css` mutes `section li` in
 * `@layer base`, so a link in a list in a section would inherit muted.
 */
function DocsPath({
	audience,
	start,
	closed = false
}: {
	audience: (typeof DOC_AUDIENCES)[number]
	/** The path's quickest way in, inside its first cell. */
	start?: React.ReactNode
	/** Something follows the cells inside the band, so the row closes on a rule of its own. */
	closed?: boolean
}) {
	const headingId = `docs-path-${audience.id}`
	const categories = audience.categories.filter(
		(category) => pagesIn(category).length > 0
	)
	return (
		<>
			<h2 id={headingId} className="text-h3">
				{audience.label}
			</h2>
			<p className="text-muted-foreground text-body-sm mt-1">
				{audience.description}
			</p>

			{/*
			  The categories are cells ruled into the sheet frame from rule to rule,
			  not tiles: a list of links reads as a table of contents, and the
			  frame's lines already group it.
			*/}
			<div
				className={cn(
					'border-foreground/10 -mx-(--frame-pad) mt-8 grid border-t',
					closed && 'border-b',
					categories.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-[1fr_2fr]'
				)}
			>
				{categories.map((category, i) => (
					<div
						key={category}
						className="border-foreground/10 flex flex-col gap-4 py-10 not-last:border-b md:px-6 md:not-first:border-l md:not-last:border-b-0 lg:px-(--frame-pad)"
					>
						<p className="text-muted-foreground text-eyebrow">
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
						{i === 0 && start}
					</div>
				))}
			</div>
		</>
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
							<Link to="/publisher" viewTransition>
								{DOCS_PAGE_COPY.publisherCta}
								<ArrowRight className="h-3.5 w-3.5" />
							</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<a
								href={COMMUNITY.github}
								target="_blank"
								rel="noopener noreferrer"
							>
								View on GitHub
							</a>
						</Button>
					</>
				}
			/>

			{/*
			  Two paths, from the manifest's audiences, one band each: the reader
			  picks by what they are doing. The page used to offer one "Start here"
			  path that began with contributor setup. Every path's cells end on the
			  next band's rule but the last one's, which the quick links follow.
			*/}
			<SheetFrame>
				{DOC_AUDIENCES.map((audience, i) => {
					const last = i === DOC_AUDIENCES.length - 1
					return (
						<Band
							key={audience.id}
							aria-labelledby={`docs-path-${audience.id}`}
							flush={!last}
						>
							<DocsPath
								audience={audience}
								closed={last}
								start={
									audience.id === 'browser' && (
										/* The publisher with a model already on its way, so there is nothing to hand over first. */
										<ModelLinkRow
											to={publisherSampleHref('rocket')}
											previewUrl={rocket.previewUrl}
											title={DOCS_PAGE_COPY.rocketSampleCta}
											meta={`${formatFileSize(rocket.bytes)} · ${rocket.hint}`}
											className="mt-auto"
											viewTransition
										/>
									)
								}
							/>
							{last && (
								<div className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-2">
									<span className="text-muted-foreground text-eyebrow">
										{DOCS_PAGE_COPY.quickLinksLabel}
									</span>
									<a
										className={quickLinkClass}
										href={COMMUNITY.github}
										target="_blank"
										rel="noopener noreferrer"
									>
										GitHub
									</a>
									<a
										className={quickLinkClass}
										href={COMMUNITY.discord}
										target="_blank"
										rel="noopener noreferrer"
									>
										Discord
									</a>
									<Link className={quickLinkClass} to="/changelog">
										Changelog
									</Link>
								</div>
							)}
						</Band>
					)
				})}
			</SheetFrame>
		</main>
	)
}

/*
  Without this a throw here reached root.tsx's last-resort fallback, which
  renders the raw error string on a bare document with no nav, no footer and no
  way back - and whose `error` class is defined in no stylesheet.
*/
export { PublicErrorBoundary as ErrorBoundary }
