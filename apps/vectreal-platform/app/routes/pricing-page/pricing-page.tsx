import { Button } from '@shared/components/ui/button'
import { useState } from 'react'
import { data, Link, useLoaderData } from 'react-router'

import { PublicErrorBoundary } from '../../components/errors'
import { PageHero } from '../../components/layout-components'
import {
	FeatureCompareGrid,
	PricingCardsSection
} from '../../components/pricing'
import { PRICING_PAGE_COPY } from '../../constants/product-copy'
import { getCheckoutOptions } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { reportServerError } from '../../lib/observability/report-server-error.server'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

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

export function meta(_: Route.MetaArgs) {
	return buildPageMeta(PUBLIC_SEO_PAGES.pricing)
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
			  The rhythm comes from four values and nothing else: 16 inside a
			  block, 32 from a heading to its content, 64 between sections that
			  answer the same question, 128 between sections that do not.

			  It had drifted to 138, 80 and 128 between peers, so the largest gap
			  on the page sat between the hero and the first thing under it while
			  two page-level sections were 48px apart - the spacing said the
			  opposite of the structure.
			*/}
			{/*
			  The rhythm is deliberately uneven. The plan row and the enterprise
			  band are one thought - here is what you can buy, and here is what to
			  do if none of it fits - so they sit close. The comparison table
			  answers a different question and gets a much wider gap before it. An
			  even `space-y` between all three said they were three peers.
			*/}
			<div className="container-page pb-32">
				{/*
				  Three self-serve plans, not four cards. Enterprise has no price,
				  no checkout and a different next step, so rendering it as a
				  fourth identical column made the row read as uniform and told the
				  reader less than the band below does. The page was already
				  carrying that band, so Enterprise had been presented twice.
				*/}
				<PricingCardsSection
					period={period}
					onPeriodChange={setPeriod}
					prices={prices}
				/>

				<section aria-labelledby="enterprise-heading" className="mt-16">
					<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
						<div className="max-w-xl space-y-2">
							<h2 id="enterprise-heading" className="text-h3 font-heading">
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
				</section>

				<section aria-labelledby="comparison-heading" className="mt-32">
					<div className="mb-8 max-w-xl space-y-2">
						{/*
						  Same rung as the Enterprise heading above it. These are peer
						  sections, and this one was a step louder - so the reference
						  table read as more important than the conversion path beside
						  it.
						*/}
						<h2 id="comparison-heading" className="text-h3 font-heading">
							{PRICING_PAGE_COPY.comparisonHeading}
						</h2>
						<p className="text-muted-foreground text-body">
							{PRICING_PAGE_COPY.comparisonDescription}
						</p>
					</div>
					<FeatureCompareGrid />
				</section>
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
