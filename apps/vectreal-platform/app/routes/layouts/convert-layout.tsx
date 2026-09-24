import { Outlet, useLocation } from 'react-router'

import { ConvertChooser } from '../../components/convert/convert-chooser'
import { ConvertFormatSwitch } from '../../components/convert/convert-format-switch'
import { PublicErrorBoundary } from '../../components/errors'
import { DitherSwap, PageHero } from '../../components/layout-components'
import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH,
	convertPairBySlug
} from '../../lib/convert/convert-pairs'

/**
 * The shared frame for /convert and every /convert/:pair page.
 *
 * The heading is derived from the path, the way `docs-layout` derives its
 * breadcrumb, rather than lifted out of the child's loader data. A layout
 * cannot read its child's loader, and the manifest is the same source either
 * way - so the pair route keeps `meta`, which needs loader data for the
 * `<title>`, and the layout owns what is drawn.
 *
 * It opens with `PageHero`, like every page the site nav leads to. An earlier
 * version refused it, so that a marketing hero would not push the converter
 * below the fold, and set a narrow heading column beside the stage instead. That
 * made the converters the one family of public pages that looked like none of
 * the others, and the column, with the format rail under it, ran far longer than
 * the converter beside it. The hero here is one line of title and one of
 * description, with the format switcher in its actions slot, so the converter
 * still starts in the first screen, now at the page's full width.
 *
 * Switching pairs keeps this layout mounted, so what changes changes in place:
 * the two format names in the heading and the description dissolve through the
 * page's dither, and the description keeps two lines' room so a shorter one
 * does not pull the switcher and the stage up under the reader's pointer.
 *
 * Below the converter, every converter again, grouped the way the index groups
 * them. The switcher only reaches the targets of the current source, and this
 * is what keeps every pair a link from every pair.
 */
export default function ConvertLayout() {
	const { pathname } = useLocation()

	const slug = pathname
		.replace(new RegExp(`^${CONVERT_INDEX_PATH}/?`), '')
		.replace(/\/$/, '')
	const pair = convertPairBySlug(slug)

	return (
		<main>
			<PageHero
				heading={
					pair ? (
						<>
							<DitherSwap value={pair.fromLabel}>{pair.fromLabel}</DitherSwap>{' '}
							to <DitherSwap value={pair.toLabel}>{pair.toLabel}</DitherSwap>{' '}
							converter
						</>
					) : (
						CONVERT_INDEX_COPY.title
					)
				}
				description={
					pair ? (
						<DitherSwap value={pair.slug} className="min-h-[2lh]">
							{pair.description}
						</DitherSwap>
					) : (
						CONVERT_INDEX_COPY.description
					)
				}
				actions={pair && <ConvertFormatSwitch pair={pair} />}
			/>
			<div className="container-page pb-32">
				<Outlet />
				{pair && (
					<section aria-labelledby="every-converter" className="mt-32">
						<h2 id="every-converter" className="text-h2 mb-16">
							Every converter
						</h2>
						<ConvertChooser current={pair.slug} groupHeading="h3" />
					</section>
				)}
			</div>
		</main>
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
