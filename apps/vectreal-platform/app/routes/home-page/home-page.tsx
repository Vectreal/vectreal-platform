import { cn } from '@shared/utils'

import { Route } from './+types/home-page'
import { FormatStrip } from '../../components/home/format-strip'
import { HeroSheet } from '../../components/home/hero/hero-sheet'
import { MissionStatement } from '../../components/home/mission-statement'
import { OpenSourceSection } from '../../components/home/open-source-section'
import { PilotOffer } from '../../components/home/pilot-offer'
import { ProductWindow } from '../../components/home/product-window'
import {
	DitherReveal,
	DraftingBackdrop
} from '../../components/layout-components'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

export function meta(_: Route.MetaArgs) {
	// The Organization node this used to pass is rendered across the public site
	// from `nav-layout` now, and was discarded here in any case.
	return buildPageMeta(PUBLIC_SEO_PAGES.home)
}

/*
  Each section a different shape: a figure, a product window, a signed
  statement, an offer, a code panel, and the converters on their own surface,
  last because they are a product of their own. The rhythm is the spacing reference's
  steps. The hero and the product window are one argument, so they sit 128
  apart; everything after starts a new one at 128, and at 192 on a wide screen,
  where 128 read as cramped between sections this size.
*/
/*
  The floor spans the window, not the measure, its lines meeting on the side
  away from each section's copy. `main` clips the overflow. The mission statement is
  left plain, the one quiet beat between the product and the offer.
*/
const BLEED = 'left-1/2 w-screen -translate-x-1/2'

const HomePage = () => (
	<main className="overflow-x-clip">
		<HeroSheet />

		<section aria-labelledby="product-heading" className="container-page mt-32">
			<DitherReveal>
				<ProductWindow />
			</DitherReveal>
		</section>

		<section aria-label="Mission" className="container-page mt-32 lg:mt-48">
			<DitherReveal>
				<MissionStatement />
			</DitherReveal>
		</section>

		<section
			aria-labelledby="pilot-heading"
			className="container-page relative isolate mt-32 lg:mt-48"
		>
			<DraftingBackdrop focusX={0.72} className={cn(BLEED, '-inset-y-16')} />
			<DitherReveal>
				<PilotOffer />
			</DitherReveal>
		</section>

		<section
			aria-labelledby="open-source-heading"
			className="container-page relative isolate mt-32 lg:mt-48"
		>
			<DraftingBackdrop focusX={0.28} className={cn(BLEED, '-inset-y-16')} />
			<DitherReveal>
				<OpenSourceSection />
			</DitherReveal>
		</section>

		<section
			aria-labelledby="converter-heading"
			className="container-page mt-32 pb-32 lg:mt-48 lg:pb-48"
		>
			<DitherReveal>
				<FormatStrip />
			</DitherReveal>
		</section>
	</main>
)

export default HomePage
