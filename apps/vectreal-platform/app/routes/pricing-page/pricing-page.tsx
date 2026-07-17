import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { useState } from 'react'
import { data, Link, useLoaderData } from 'react-router'

import {
	FeatureCompareGrid,
	PricingCardsSection
} from '../../components/dashboard'
import { BasicCard, PageHero } from '../../components/layout-components'
import { PRICING_PAGE_COPY } from '../../constants/product-copy'
import { getCheckoutOptions } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

import type { Route } from './+types/pricing-page'

export async function loader(_: Route.LoaderArgs) {
	try {
		const prices = await getCheckoutOptions()
		return data({ prices })
	} catch (error) {
		// Stripe may not be configured in all environments - graceful fallback
		console.error('Failed to load checkout options for pricing page.', error)
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
			<PageHero
				eyebrow="Pricing"
				heading={PRICING_PAGE_COPY.heading}
				description={PRICING_PAGE_COPY.description}
				actions={
					<>
						<Badge variant="secondary">4 Plans</Badge>
						<Badge variant="secondary">Free to start</Badge>
						<Badge variant="secondary">Cancel anytime</Badge>
					</>
				}
			/>

			<div className="mx-auto max-w-7xl space-y-20 px-6 py-16">
				<PricingCardsSection
					period={period}
					onPeriodChange={setPeriod}
					prices={prices}
				/>

				<Separator />

				<FeatureCompareGrid />

				{/* Enterprise CTA */}
				<BasicCard as="section" cardClassName="p-6 text-left md:p-8">
					<h2 className="text-2xl font-medium">
						{PRICING_PAGE_COPY.enterpriseHeading}
					</h2>
					<p className="text-muted-foreground max-w-lg">
						{PRICING_PAGE_COPY.enterpriseDescription}
					</p>
					<div className="flex justify-start gap-4">
						<Link to="/contact">
							<Button size="lg">Contact sales</Button>
						</Link>
						<Link to="/docs">
							<Button size="lg" variant="secondary">
								Read the docs
							</Button>
						</Link>
					</div>
				</BasicCard>
			</div>
		</main>
	)
}
