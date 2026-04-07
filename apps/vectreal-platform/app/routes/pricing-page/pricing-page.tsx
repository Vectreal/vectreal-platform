import { usePostHog } from '@posthog/react'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { useEffect, useState } from 'react'
import { data, Link, useLoaderData } from 'react-router'

import { FeatureCompareGrid } from '../../components/dashboard/billing/feature-compare-grid'
import { PricingCardsSection } from '../../components/dashboard/billing/pricing-cards-section'
import { getCheckoutOptions } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'
import { buildPageMeta } from '../../lib/seo'

import type { Route } from './+types/pricing-page'

export async function loader(_: Route.LoaderArgs) {
	try {
		const prices = await getCheckoutOptions()
		return data({ prices })
	} catch (error) {
		// Stripe may not be configured in all environments — graceful fallback
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
	const posthog = usePostHog()

	useEffect(() => {
		posthog?.capture('view_pricing', { source: 'direct' })
	}, [posthog])

	return (
		<main className="mx-auto max-w-7xl space-y-20 px-6 py-16">
			{/* Hero */}
			<section className="space-y-4 text-center">
				<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
					Simple, transparent pricing
				</h1>
				<p className="text-muted-foreground mx-auto max-w-xl text-lg">
					Start for free. Upgrade when you need more. Every plan includes the
					core 3D publishing workflow — no hidden fees.
				</p>
			</section>

			<PricingCardsSection
				period={period}
				onPeriodChange={setPeriod}
				prices={prices}
			/>

			<Separator />

			<FeatureCompareGrid />

			{/* Enterprise CTA */}
			<section className="bg-muted/30 rounded-2xl p-10 text-center">
				<h2 className="text-2xl font-bold">Need a custom setup?</h2>
				<p className="text-muted-foreground mx-auto mt-2 max-w-lg">
					Enterprise plans include custom data residency, dedicated support,
					audit log export, and bespoke SLA agreements. Talk to us.
				</p>
				<div className="mt-6 flex justify-center gap-4">
					<Link to="/contact">
						<Button size="lg">Contact sales</Button>
					</Link>
					<Link to="/docs">
						<Button size="lg" variant="outline">
							Read the docs
						</Button>
					</Link>
				</div>
			</section>
		</main>
	)
}
