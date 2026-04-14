import { usePostHog } from '@posthog/react'
import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { useEffect, useState } from 'react'
import { data, Link, useLoaderData } from 'react-router'

import {
	FeatureCompareGrid,
	PricingCardsSection
} from '../../components/dashboard'
import { getCheckoutOptions } from '../../lib/domain/billing/billing-dashboard-loader.server'
import { buildPageMeta } from '../../lib/seo'
import { PUBLIC_SEO_PAGES } from '../../lib/seo-registry'

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
		<main className="mx-auto max-w-7xl space-y-20 px-6 py-16 pt-24">
			<header className="space-y-4">
				<p className="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
					Pricing
				</p>
				<h1 className="max-w-4xl text-4xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
					Simple, transparent pricing for every workflow.
				</h1>
				<p className="text-muted-foreground max-w-3xl text-base leading-relaxed md:text-lg">
					Start for free. Upgrade when you need more. Every plan includes the
					core 3D publishing workflow — no hidden fees.
				</p>
				<div className="flex flex-wrap gap-2 pt-2 text-xs">
					<Badge variant="outline">4 Plans</Badge>
					<Badge variant="outline">Free to start</Badge>
					<Badge variant="outline">Cancel anytime</Badge>
				</div>
			</header>

			<PricingCardsSection
				period={period}
				onPeriodChange={setPeriod}
				prices={prices}
			/>

			<Separator />

			<FeatureCompareGrid />

			{/* Enterprise CTA */}
			<section className="bg-muted/30 rounded-2xl p-10 text-left">
				<h2 className="text-2xl font-medium">Need a custom setup?</h2>
				<p className="text-muted-foreground mt-2 max-w-lg">
					Enterprise plans include custom data residency, dedicated support,
					audit log export, and bespoke SLA agreements. Talk to us.
				</p>
				<div className="mt-6 flex justify-start gap-4">
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
