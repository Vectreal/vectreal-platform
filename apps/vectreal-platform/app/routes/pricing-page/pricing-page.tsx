import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
import { Check, Minus, Zap } from 'lucide-react'
import { Link } from 'react-router'

import {
	PLAN_ENTITLEMENTS,
	PLAN_LIMITS,
	type Plan
} from '../../constants/plan-config'

import type { Route } from './+types/pricing-page'

export function meta(_: Route.MetaArgs) {
	return [
		{ title: 'Pricing — Vectreal' },
		{
			name: 'description',
			content:
				'Simple, transparent pricing for every team. From hobbyists to enterprise studios — find the plan that fits your 3D publishing workflow.'
		},
		{ property: 'og:title', content: 'Pricing — Vectreal' },
		{
			property: 'og:description',
			content:
				'Simple, transparent pricing for every team. From hobbyists to enterprise studios — find the plan that fits your 3D publishing workflow.'
		}
	]
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const PLAN_DISPLAY: Record<
	Plan,
	{
		name: string
		tagline: string
		monthlyPrice: number | null
		annualMonthlyPrice: number | null
		highlighted: boolean
		cta: string
		ctaHref: string | null
	}
> = {
	free: {
		name: 'Free',
		tagline: 'For hobbyists and open-source projects',
		monthlyPrice: 0,
		annualMonthlyPrice: 0,
		highlighted: false,
		cta: 'Get started free',
		ctaHref: '/sign-up'
	},
	pro: {
		name: 'Pro',
		tagline: 'For independent creators and small studios',
		monthlyPrice: 29,
		annualMonthlyPrice: 23,
		highlighted: true,
		cta: 'Start with Pro',
		ctaHref: null // Handled by checkout
	},
	business: {
		name: 'Business',
		tagline: 'For growing teams and agencies',
		monthlyPrice: 79,
		annualMonthlyPrice: 63,
		highlighted: false,
		cta: 'Start with Business',
		ctaHref: null // Handled by checkout
	},
	enterprise: {
		name: 'Enterprise',
		tagline: 'Custom SLA and dedicated support',
		monthlyPrice: null,
		annualMonthlyPrice: null,
		highlighted: false,
		cta: 'Contact sales',
		ctaHref: '/contact'
	}
}

function formatBytes(bytes: number | null): string {
	if (bytes === null) return 'Custom'
	const gb = bytes / (1024 * 1024 * 1024)
	if (gb >= 1) return `${gb.toLocaleString()} GB`
	const mb = bytes / (1024 * 1024)
	return `${mb.toLocaleString()} MB`
}

function formatLimit(value: number | null, unit?: string): string {
	if (value === null) return 'Unlimited'
	return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`
}

// Key limits to surface in the plan cards
const HIGHLIGHTED_LIMITS: Array<{
	key: keyof (typeof PLAN_LIMITS)['free']
	label: string
	format: (v: number | null) => string
}> = [
	{
		key: 'storage_bytes_total',
		label: 'Storage',
		format: formatBytes
	},
	{
		key: 'scenes_total',
		label: 'Scenes',
		format: (v) => formatLimit(v)
	},
	{
		key: 'scenes_published_concurrent',
		label: 'Published scenes',
		format: (v) => formatLimit(v)
	},
	{
		key: 'projects_total',
		label: 'Projects',
		format: (v) => formatLimit(v)
	},
	{
		key: 'optimization_runs_per_month',
		label: 'Optimization runs / month',
		format: (v) => formatLimit(v)
	},
	{
		key: 'org_seats',
		label: 'Team seats',
		format: (v) => formatLimit(v)
	}
]

// Feature groups to show in the comparison matrix
const FEATURE_GROUPS: Array<{
	label: string
	features: Array<{ key: keyof (typeof PLAN_ENTITLEMENTS)['free']; label: string }>
}> = [
	{
		label: 'Publishing',
		features: [
			{ key: 'scene_upload', label: 'Scene upload' },
			{ key: 'scene_optimize', label: 'Optimization pipeline' },
			{ key: 'scene_publish', label: 'Publish to CDN' },
			{ key: 'scene_embed', label: 'Embed snippet' },
			{ key: 'scene_preview_private', label: 'Private preview link' },
			{ key: 'scene_version_history', label: 'Version history' }
		]
	},
	{
		label: 'Optimization',
		features: [
			{ key: 'optimization_preset_low', label: 'Low / Medium presets' },
			{ key: 'optimization_preset_high', label: 'High-quality preset' },
			{ key: 'optimization_custom_params', label: 'Custom parameters' },
			{ key: 'optimization_priority_queue', label: 'Priority queue' }
		]
	},
	{
		label: 'Embed & Viewer',
		features: [
			{ key: 'embed_domain_allowlist', label: 'Domain allowlist' },
			{ key: 'embed_branding_removal', label: 'Remove Vectreal branding' },
			{ key: 'embed_viewer_customisation', label: 'Viewer customisation' },
			{ key: 'embed_analytics', label: 'Embed analytics' },
			{ key: 'embed_ar_mode', label: 'AR / WebXR mode' }
		]
	},
	{
		label: 'Organisation',
		features: [
			{ key: 'org_multi_member', label: 'Multi-member workspace' },
			{ key: 'org_roles', label: 'Role-based access' },
			{ key: 'org_api_keys', label: 'API keys' },
			{ key: 'org_sso', label: 'SAML / OIDC SSO' },
			{ key: 'org_audit_log', label: 'Audit log export' }
		]
	},
	{
		label: 'Support',
		features: [
			{ key: 'support_community', label: 'Community & Discord' },
			{ key: 'support_email', label: 'Email support (48 h SLA)' },
			{ key: 'support_priority', label: 'Priority support (8 h SLA)' },
			{ key: 'support_dedicated', label: 'Dedicated support channel' }
		]
	}
]

const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function FeatureCheck({ granted }: { granted: boolean }) {
	if (granted) {
		return <Check className="text-primary mx-auto h-4 w-4" />
	}
	return <Minus className="text-muted-foreground mx-auto h-4 w-4" />
}

function PlanCard({ plan }: { plan: Plan }) {
	const display = PLAN_DISPLAY[plan]
	const limits = PLAN_LIMITS[plan]

	const isEnterprise = plan === 'enterprise'

	return (
		<Card
			className={cn(
				'flex flex-col',
				display.highlighted && 'border-primary ring-primary ring-2'
			)}
		>
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between">
					<CardTitle className="text-xl">{display.name}</CardTitle>
					{display.highlighted && (
						<Badge className="bg-primary text-primary-foreground">
							Most popular
						</Badge>
					)}
				</div>
				<CardDescription>{display.tagline}</CardDescription>
				<div className="pt-2">
					{isEnterprise ? (
						<p className="text-2xl font-bold">Custom</p>
					) : display.monthlyPrice === 0 ? (
						<div>
							<span className="text-4xl font-extrabold">$0</span>
							<span className="text-muted-foreground ml-1 text-sm">/month</span>
						</div>
					) : (
						<div>
							<span className="text-4xl font-extrabold">
								${display.monthlyPrice}
							</span>
							<span className="text-muted-foreground ml-1 text-sm">/month</span>
							{display.annualMonthlyPrice !== null && (
								<p className="text-muted-foreground mt-1 text-xs">
									${display.annualMonthlyPrice}/month billed annually (save 20%)
								</p>
							)}
						</div>
					)}
				</div>
			</CardHeader>

			<CardContent className="flex-1 space-y-3">
				{HIGHLIGHTED_LIMITS.map(({ key, label, format }) => (
					<div key={key} className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">{label}</span>
						<span className="font-medium">{format(limits[key])}</span>
					</div>
				))}
			</CardContent>

			<CardFooter>
				{display.ctaHref ? (
					<Link to={display.ctaHref} className="w-full">
						<Button
							className="w-full"
							variant={display.highlighted ? 'default' : 'outline'}
						>
							{display.highlighted && <Zap className="mr-2 h-4 w-4" />}
							{display.cta}
						</Button>
					</Link>
				) : (
					<Link to={`/dashboard/settings?upgrade=${plan}`} className="w-full">
						<Button
							className="w-full"
							variant={display.highlighted ? 'default' : 'outline'}
						>
							{display.highlighted && <Zap className="mr-2 h-4 w-4" />}
							{display.cta}
						</Button>
					</Link>
				)}
			</CardFooter>
		</Card>
	)
}

function FeatureMatrixRow({
	label,
	plans
}: {
	label: string
	plans: { plan: Plan; granted: boolean }[]
}) {
	return (
		<tr className="border-border border-b last:border-0">
			<td className="py-3 pr-4 text-sm">{label}</td>
			{plans.map(({ plan, granted }) => (
				<td key={plan} className="py-3 text-center">
					<FeatureCheck granted={granted} />
				</td>
			))}
		</tr>
	)
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
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

			{/* Plan cards */}
			<section>
				<div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
					{PLANS.map((plan) => (
						<PlanCard key={plan} plan={plan} />
					))}
				</div>
			</section>

			<Separator />

			{/* Feature matrix */}
			<section className="space-y-8">
				<h2 className="text-2xl font-bold">Full feature comparison</h2>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[640px] table-auto text-left">
						<thead>
							<tr className="border-border border-b">
								<th className="pb-4 pr-4 text-sm font-medium" />
								{PLANS.map((plan) => (
									<th
										key={plan}
										className={cn(
											'pb-4 text-center text-sm font-semibold',
											PLAN_DISPLAY[plan].highlighted && 'text-primary'
										)}
									>
										{PLAN_DISPLAY[plan].name}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{FEATURE_GROUPS.map(({ label, features }) => (
								<>
									<tr key={label} className="bg-muted/30">
										<td
											colSpan={PLANS.length + 1}
											className="py-2 pr-4 text-xs font-semibold tracking-wider uppercase"
										>
											{label}
										</td>
									</tr>
									{features.map(({ key, label: featureLabel }) => (
										<FeatureMatrixRow
											key={key}
											label={featureLabel}
											plans={PLANS.map((plan) => ({
												plan,
												granted: PLAN_ENTITLEMENTS[plan][key]
											}))}
										/>
									))}
								</>
							))}
						</tbody>
					</table>
				</div>
			</section>

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
