import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { DocsScenePreview } from '../../components/docs/docs-scene-preview'
import { PublicErrorBoundary } from '../../components/errors'
import { PageHero } from '../../components/layout-components'
import { DOCS_PAGE_COPY } from '../../constants/product-copy'
import {
	DOC_CATEGORY_LABELS,
	DOC_CATEGORY_ORDER,
	docsPages,
	type DocCategory
} from '../../lib/docs/docs-manifest'
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
/*
  The generated embed snippet, matching `docs/guides/publish-embed`. The `<style>`
  block that guide ships alongside it is left out here and explained there: it
  exists for flex parents, and repeating it without its three paragraphs of
  reasoning would be copy without the caveat.
*/
const EMBED_SNIPPET = `<div class="vctrl-embed" style="width: 100%; height: 400px;">
  <iframe
    src="https://vectreal.com/embed/<projectId>/<sceneId>?token=<key>"
    style="width: 100%; height: 100%; border: 0;"
    allow="autoplay; xr-spatial-tracking"
    allowfullscreen
  ></iframe>
</div>`

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
 *
 * Two things the row does NOT own, both learned the hard way:
 *
 * The divider belongs to the list, not the row. With `border-b last:border-b-0`
 * on the row, wrapping rows in `<li>` made every row the last child of its own
 * parent, so the rule fired on all of them and the Start here panel rendered
 * with no dividers while the sections below kept theirs.
 *
 * The hairline and the radius are on different elements, and they have to be. A
 * border follows its own box's `border-radius`, so a rounded row with a
 * `border-bottom` draws a divider that curves up at both ends and reads as a
 * rounded underline rather than a rule between two items. The wrapper is square
 * and owns the line; the link is rounded and owns the hover.
 *
 * The title states its colour. `globals.css` has `section p, section li {
 * color: var(--muted-foreground) }` in `@layer base`, so a row inside a list
 * inside a section inherits muted and the title renders the same colour as its
 * own description.
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
		<div className="border-border border-b last:border-b-0">
			<Link
				to={to}
				className="group -mx-3 flex flex-col gap-1 rounded-xl px-3 py-4 transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))] sm:flex-row sm:items-baseline sm:gap-6"
			>
				<span className="text-h4 text-foreground sm:w-56 sm:shrink-0">
					{title}
				</span>
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
		</div>
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
		<main className="bg-background">
			<PageHero
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

			<div className="container-page pb-32">
				{/*
				  The artifact and the code that produces it, side by side.

				  The viewer on the left is the package the rows below teach you
				  to install, running live. The snippet on the right is the embed
				  markup from `docs/guides/publish-embed`, unabridged apart from
				  the stylesheet that guide explains separately - so it is a real
				  artifact rather than an illustration of one.
				*/}
				<section
					aria-labelledby="what-you-make"
					className="grid items-center gap-8 md:grid-cols-2"
				>
					<DocsScenePreview />
					{/* min-w-0 so the snippet's own scroll container can shrink; a grid
					    item defaults to min-width: auto and would size to the code. */}
					<div className="min-w-0 space-y-4">
						<h2 id="what-you-make" className="text-h3 font-heading">
							{DOCS_PAGE_COPY.previewHeading}
						</h2>
						<p className="text-muted-foreground text-body">
							{DOCS_PAGE_COPY.previewDescription}
						</p>
						{/*
						  Same four values as the `pre` rule in `styles/mdx.module.css`,
						  which renders every code block on the pages this one links to.
						  It was 11px here and 14px there.
						*/}
						<pre className="ds-sunken text-body-sm overflow-x-auto rounded-xl p-4 font-mono">
							<code>{EMBED_SNIPPET}</code>
						</pre>
					</div>
				</section>

				{/*
				  The one path most readers want, given weight the other sections
				  do not get. The page previously offered four equal doors and made
				  the reader guess which one held their answer.

				  Weight from position and space, not from a panel or a rule. A
				  fill is the heaviest way to group three links; a rule above a
				  section that already has air above it is a line carrying no
				  information. A rule earns its place between repeated items in a
				  list, where it separates equivalent things - which is exactly
				  where the rows below still use one.
				*/}
				<section aria-labelledby="start-here" className="mt-32">
					<div className="mb-4 max-w-xl space-y-1">
						<h2 id="start-here" className="text-h3 font-heading">
							{DOCS_PAGE_COPY.startHereHeading}
						</h2>
						<p className="text-muted-foreground text-body-sm">
							{DOCS_PAGE_COPY.startHereDescription}
						</p>
					</div>
					<div className="flex flex-col">
						{gettingStarted.map((page) => (
							<DocsRow
								key={page.slug}
								to={`/docs/${page.slug}`}
								title={page.title}
								{...(page.description ? { description: page.description } : {})}
							/>
						))}
					</div>
				</section>

				{/*
				  Every category after "getting-started", in the manifest's own order
				  and under the manifest's own label. Three of these were hardcoded
				  and Contributing was folded into the Operations heading, so the
				  page disagreed with the sidebar and a sixth DocCategory would have
				  compiled and silently never rendered.

				  Every heading comes from the manifest, with no exceptions - Packages
				  used to override it with a second label ("Packages" against the
				  sidebar's "Package Reference"), which is the disagreement this was
				  meant to end. It still adds a description, because that is copy the
				  manifest does not carry rather than a competing name for the
				  section.
				*/}
				{DOC_CATEGORY_ORDER.filter(
					(category) => category !== 'getting-started'
				).map((category) => {
					const pages = pagesIn(category)
					if (pages.length === 0) return null

					return (
						<DocsSection
							key={category}
							heading={DOC_CATEGORY_LABELS[category]}
							{...(category === 'packages'
								? { description: DOCS_PAGE_COPY.packagesDescription }
								: {})}
							className="mt-32"
						>
							{pages.map((page) => (
								<DocsRow
									key={page.slug}
									to={`/docs/${page.slug}`}
									title={page.title}
									{...(page.title.startsWith('@vctrl/')
										? { aside: `npm i ${page.title}` }
										: {})}
									{...(page.description
										? { description: page.description }
										: {})}
								/>
							))}
						</DocsSection>
					)
				})}

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
		</main>
	)
}

/*
  Without this a throw here reached root.tsx's last-resort fallback, which
  renders the raw error string on a bare document with no nav, no footer and no
  way back - and whose `error` class is defined in no stylesheet.
*/
export { PublicErrorBoundary as ErrorBoundary }
