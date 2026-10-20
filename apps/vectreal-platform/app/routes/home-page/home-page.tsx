import { Route } from './+types/home-page'
import { FormatStrip } from '../../components/home/format-strip'
import { HeroSheet } from '../../components/home/hero/hero-sheet'
import { MissionStatement } from '../../components/home/mission-statement'
import { OpenSourceSection } from '../../components/home/open-source-section'
import { PilotBand } from '../../components/home/pilot-band'
import { ProductWindow } from '../../components/home/product-window'
import {
	Band,
	DraftingBackdrop,
	SheetFrame
} from '../../components/layout-components'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

export function meta(_: Route.MetaArgs) {
	// The Organization node this used to pass is rendered across the public site
	// from `nav-layout` now, and was discarded here in any case.
	return buildPageMeta(PUBLIC_SEO_PAGES.home)
}

/*
  The hero runs edge to edge; below it one sheet frame holds the page, each
  section a band inside its rules. Each band a different shape: the free-model
  offer first, then a product window, a signed statement, a code panel, and the
  converters ruled into the frame's last row. The mission statement is the page's one break,
  full bleed and inverted, with the drafting floor under it; there is no floor
  anywhere else on the page, so ground and light belong to an object, never to
  the page as wallpaper.
*/
const HomePage = () => (
	<main>
		<HeroSheet />

		<SheetFrame>
			<Band aria-labelledby="product-heading">
				<ProductWindow />
			</Band>

			<Band
				aria-label="Mission"
				inverted
				backdrop={<DraftingBackdrop focusX={0.72} horizon={0.56} />}
			>
				<MissionStatement />
			</Band>

			<Band aria-labelledby="pilot-heading">
				<PilotBand />
			</Band>

			<Band aria-labelledby="open-source-heading">
				<OpenSourceSection />
			</Band>

			<Band aria-labelledby="converter-heading" flush>
				<FormatStrip />
			</Band>
		</SheetFrame>
	</main>
)

export default HomePage
