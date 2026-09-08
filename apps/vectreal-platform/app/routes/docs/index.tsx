import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { PageHero } from '../../components/layout-components'
import { DOCS_PAGE_COPY } from '../../constants/product-copy'
import { docsPages, type DocCategory } from '../../lib/docs/docs-manifest'
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

/**
 * One docs page as a directory row.
 *
 * Rows rather than cards. Four identical icon-over-title-over-one-line cards is
 * the single most recognisable templated-layout pattern, and it also told the
 * reader less than this does: a card showed a category, a row shows the page
 * they are actually looking for.
 *
 * The hover mixes 8%, the overlay step, not 4%. These rows also render inside
 * the raised "Start here" panel, and 4% is exactly what `.ds-raised` already
 * paints - so at 4% the three most important rows on the page had no hover
 * feedback at all while every row outside the panel did.
 */
function DocsRow({
	to,
	title,
	description,
	aside
}: {
	to: string
	title: string
	description?: string
	aside?: string
}) {
	return (
		<Link
			to={to}
			className="group border-border -mx-3 flex flex-col gap-1 rounded-xl border-b px-3 py-4 transition-colors duration-150 last:border-b-0 hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))] sm:flex-row sm:items-baseline sm:gap-6"
		>
			<span className="text-h4 sm:w-56 sm:shrink-0">{title}</span>
			{description && (
				<span className="text-muted-foreground text-body-sm flex-1">
					{description}
				</span>
			)}
			{aside && (
				<code className="text-muted-foreground text-label-xs font-mono sm:shrink-0">
					{aside}
				</code>
			)}
		</Link>
	)
}

function DocsSection({
	heading,
	description,
	children,
	className
}: {
	heading: string
	description?: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<section className={className}>
			<div className="mb-4 max-w-xl space-y-1">
				<h2 className="text-h3 font-heading">{heading}</h2>
				{description && (
					<p className="text-muted-foreground text-body-sm">{description}</p>
				)}
			</div>
			<div className="flex flex-col">{children}</div>
		</section>
	)
}

export default function DocsIndexPage() {
	const gettingStarted = pagesIn('getting-started')

	return (
		<div className="bg-background">
			<PageHero
				eyebrow="Documentation"
				heading={DOCS_PAGE_COPY.heading}
				description={DOCS_PAGE_COPY.description}
				actions={
					<>
						<Button asChild size="sm">
							<Link to="/docs/getting-started">
								Start here
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

			<div className="container-page pb-24">
				{/*
				  The one path most readers want, given weight the other sections
				  do not get. The page previously offered four equal doors and made
				  the reader guess which one held their answer.
				*/}
				<section
					aria-labelledby="start-here"
					className="ds-raised rounded-2xl p-6 md:p-8"
				>
					<div className="mb-4 max-w-xl space-y-1">
						<h2 id="start-here" className="text-h3 font-heading">
							{DOCS_PAGE_COPY.startHereHeading}
						</h2>
						<p className="text-muted-foreground text-body-sm">
							{DOCS_PAGE_COPY.startHereDescription}
						</p>
					</div>
					<ol className="flex flex-col">
						{gettingStarted.map((page) => (
							<li key={page.slug}>
								<DocsRow
									to={`/docs/${page.slug}`}
									title={page.title}
									{...(page.description
										? { description: page.description }
										: {})}
								/>
							</li>
						))}
					</ol>
				</section>

				<DocsSection heading="Guides" className="mt-20">
					{pagesIn('guides').map((page) => (
						<DocsRow
							key={page.slug}
							to={`/docs/${page.slug}`}
							title={page.title}
							{...(page.description ? { description: page.description } : {})}
						/>
					))}
				</DocsSection>

				{/*
				  The package rows carry their install line. It is the thing a
				  reader on this section actually wants next, and it is real
				  product rather than a description of it.
				*/}
				<DocsSection
					heading={DOCS_PAGE_COPY.packagesHeading}
					description={DOCS_PAGE_COPY.packagesDescription}
					className="mt-20"
				>
					{pagesIn('packages').map((page) => (
						<DocsRow
							key={page.slug}
							to={`/docs/${page.slug}`}
							title={page.title}
							{...(page.title.startsWith('@vctrl/')
								? { aside: `npm i ${page.title}` }
								: {})}
							{...(page.description ? { description: page.description } : {})}
						/>
					))}
				</DocsSection>

				<DocsSection heading="Operations" className="mt-20">
					{[...pagesIn('operations'), ...pagesIn('contributing')].map(
						(page) => (
							<DocsRow
								key={page.slug}
								to={`/docs/${page.slug}`}
								title={page.title}
								{...(page.description ? { description: page.description } : {})}
							/>
						)
					)}
				</DocsSection>

				<div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-2">
					<span className="text-muted-foreground text-eyebrow">
						{DOCS_PAGE_COPY.quickLinksLabel}
					</span>
					<a
						className="text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150"
						href="https://github.com/Vectreal/vectreal-platform"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<Link
						className="text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150"
						to="/publisher"
					>
						Publisher
					</Link>
					<a
						className="text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150"
						href="https://discord.gg/A9a3nPkZw7"
						target="_blank"
						rel="noopener noreferrer"
					>
						Discord
					</a>
					<Link
						className="text-body-sm decoration-muted-foreground hover:decoration-orange underline underline-offset-4 transition-colors duration-150"
						to="/changelog"
					>
						Changelog
					</Link>
				</div>
			</div>
		</div>
	)
}
