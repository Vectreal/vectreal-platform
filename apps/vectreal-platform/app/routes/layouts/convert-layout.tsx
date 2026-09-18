import { Outlet, useLocation } from 'react-router'

import { ConvertFormatNav } from '../../components/convert/convert-format-nav'
import { PublicErrorBoundary } from '../../components/errors'
import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH,
	convertPairBySlug
} from '../../lib/convert/convert-pairs'

/**
 * The shared frame for /convert and every /convert/:pair page.
 *
 * The pair pages shipped as orphans: each rendered its own bare heading and
 * linked to nothing, so the family had no header treatment and no way to move
 * between its members. Docs, the newsroom and the legal MDX pages each have a
 * layout; this is the converters' one.
 *
 * The heading is derived from the path, the way `docs-layout` derives its
 * breadcrumb, rather than lifted out of the child's loader data. A layout
 * cannot read its child's loader, and the manifest is the same source either
 * way - so the pair route keeps `meta`, which needs loader data for the
 * `<title>`, and the layout owns what is drawn.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO
 * --------------------------------------
 * It does not use `PageHero`, and the first version did. That component owns the
 * four nav pages, where a `text-display` heading over a full-width band is the
 * event at the top of a page that has nothing else above the fold. Here there
 * is something else: the converter. Stacking a marketing hero on top of it put
 * the one control the page exists for below the fold and left the first screen
 * as a heading, a grey line and a dashed box - which is the templated look
 * `anti-ai-look.md` is written against, arrived at by reaching for the nearest
 * shared component rather than by deciding anything.
 *
 * And the columns are not a sidebar plus content. The heading, the switcher and
 * the converter are one composition: text column narrow and fixed, stage column
 * wide and fluid, the switcher tucked under the text rather than given a rail
 * of its own. On a phone the order is heading, converter, switcher, so the drop
 * target is never pushed down by navigation.
 */
export default function ConvertLayout() {
	const { pathname } = useLocation()

	const slug = pathname
		.replace(new RegExp(`^${CONVERT_INDEX_PATH}/?`), '')
		.replace(/\/$/, '')
	const pair = convertPairBySlug(slug)

	return (
		<div className="container-page pt-28 pb-24 md:pt-32">
			<div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
				<header className="lg:col-start-1 lg:row-start-1">
					<h1 className="text-headline">
						{pair ? pair.title : CONVERT_INDEX_COPY.title}
					</h1>
					<p className="text-muted-foreground text-body mt-4 max-w-md">
						{pair ? pair.description : CONVERT_INDEX_COPY.description}
					</p>
				</header>

				{/*
				  Spanning both rows of the left column, so the stage starts level
				  with the heading instead of below the switcher.
				*/}
				<main className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
					<Outlet />
				</main>

				{/*
				  No rail on the index. The index page IS the chooser - a from-by-to
				  matrix of every conversion - so a rail beside it would be the same
				  two links spelled a second way, and "All converters" there would
				  point at the page the reader is already on.
				*/}
				{pair && (
					<div className="lg:col-start-1 lg:row-start-2">
						<ConvertFormatNav pathname={pathname} />
					</div>
				)}
			</div>
		</div>
	)
}

/*
  Owned here for the same reason the docs layout owns one: without it a throw in
  any converter route reaches root.tsx's last-resort fallback, which renders the
  raw error string on a bare document. That includes the 404 the pair loader
  throws for an unknown slug, which is the most likely error on this family by
  a wide margin.
*/
export { PublicErrorBoundary as ErrorBoundary }
