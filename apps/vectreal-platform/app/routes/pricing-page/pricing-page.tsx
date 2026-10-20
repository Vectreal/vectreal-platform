import { Button } from '@shared/components/ui/button'
import { useState } from 'react'
import { data, Link, useLoaderData } from 'react-router'

import { PublicErrorBoundary } from '../../components/errors'
import { Band, PageHero, SheetFrame } from '../../components/layout-components'
import { routeErrorMeta } from '../../components/not-found'
import {
	FeatureCompareGrid,
	PricingCardsSection
} from '../../components/pricing'
import { PRICING_PAGE_COPY } from '../../constants/product-copy'
import { getCheckoutOptions } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'
import { shareCardMeta } from '../../lib/share-cards'

import type { Route } from './+types/pricing-page'

export async function loader({ request }: Route.LoaderArgs) {
	try {
		const prices = await getCheckoutOptions()
		return data({ prices })
	} catch (error) {
		/*
		  Degrades to a page with no prices on it. Stripe genuinely may not be
		  configured outside production, which is why this is a fallback rather
		  than a throw - and also why it needs reporting: in production the same
		  branch means the pricing page is quietly selling nothing.
		*/
		reportServerError(error, { request })
		return data({ prices: null })
	}
}

export function meta({ error }: Route.MetaArgs) {
	if (error) return routeErrorMeta(error)
	return buildPageMeta({
		...PUBLIC_SEO_PAGES.pricing,
		...shareCardMeta('pricing')
	})
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
	const { prices } = useLoaderData<typeof loader>()
	const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')

	return (
		<main>
			{/*
			  The hero carried three pill badges - "4 Plans", "Free to start",
			  "Cancel anytime" - directly under the H1. A pill row below the
			  heading and a set of three parallel phrases are both named tells,
			  and these earned removal twice over by restating what the
			  description above them and the cards below them already say.
			*/}
			<PageHero
				heading={PRICING_PAGE_COPY.heading}
				description={PRICING_PAGE_COPY.description}
			/>

			{/*
			  The head runs edge to edge above the sheet frame, as the home hero
			  does; below it each section is a band. The plans are one band, their
			  row ruled into the frame as its last line. Enterprise is a band of its
			  own rather than a fourth card: it has no price, no checkout and a
			  different next step. The comparison table answers a different
			  question again, so it is a third.
			*/}
			<SheetFrame>
				<Band flush>
					<PricingCardsSection
						period={period}
						onPeriodChange={setPeriod}
						prices={prices}
					/>
				</Band>

				<Band aria-labelledby="enterprise-heading">
					<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
						<div className="max-w-xl space-y-2">
							<h2 id="enterprise-heading" className="text-h3">
								{PRICING_PAGE_COPY.enterpriseHeading}
							</h2>
							<p className="text-muted-foreground text-body">
								{PRICING_PAGE_COPY.enterpriseDescription}
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap gap-3">
							<Button asChild>
								<Link to="/contact">Talk to us</Link>
							</Button>
							<Button variant="secondary" asChild>
								<Link to="/docs">Read the docs</Link>
							</Button>
						</div>
					</div>
				</Band>

				<Band aria-labelledby="comparison-heading">
					<div className="mb-8 max-w-xl space-y-2">
						<h2 id="comparison-heading" className="text-h3">
							{PRICING_PAGE_COPY.comparisonHeading}
						</h2>
						<p className="text-muted-foreground text-body">
							{PRICING_PAGE_COPY.comparisonDescription}
						</p>
					</div>
					<FeatureCompareGrid />
				</Band>
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
