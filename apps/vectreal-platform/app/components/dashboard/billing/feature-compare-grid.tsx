/**
 * FeatureCompareGrid
 * Full feature comparison table across all four plans.
 * Extracted from pricing-page.tsx so it can be reused on the upgrade route.
 */

import { cn } from '@shared/utils'
import { Check, Minus } from 'lucide-react'
import React from 'react'

import { PLAN_ENTITLEMENTS, type Plan } from '../../../constants/plan-config'

// ---------------------------------------------------------------------------
// Feature groups & plan display labels (mirrors pricing-page)
// ---------------------------------------------------------------------------

const PLAN_DISPLAY_NAME: Record<Plan, string> = {
	free: 'Free',
	pro: 'Pro',
	business: 'Business',
	enterprise: 'Enterprise'
}

const PLAN_IS_HIGHLIGHTED: Record<Plan, boolean> = {
	free: false,
	pro: true,
	business: false,
	enterprise: false
}

const FEATURE_GROUPS: Array<{
	label: string
	features: Array<{
		key: keyof (typeof PLAN_ENTITLEMENTS)['free']
		label: string
	}>
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
// Sub-components
// ---------------------------------------------------------------------------

function FeatureCheck({ granted }: { granted: boolean }) {
	if (granted) {
		return <Check className="text-primary mx-auto h-4 w-4" />
	}
	return <Minus className="text-muted-foreground mx-auto h-4 w-4" />
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
// FeatureCompareGrid (exported)
// ---------------------------------------------------------------------------

export function FeatureCompareGrid() {
	return (
		<section className="space-y-4">
			<h2 className="text-2xl font-bold">Full feature comparison</h2>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] table-auto text-left">
					<thead>
						<tr className="border-border border-b">
							<th className="pr-4 pb-4 text-sm font-medium" />
							{PLANS.map((plan) => (
								<th
									key={plan}
									className={cn(
										'pb-4 text-center text-sm font-semibold',
										PLAN_IS_HIGHLIGHTED[plan] && 'text-primary'
									)}
								>
									{PLAN_DISPLAY_NAME[plan]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{FEATURE_GROUPS.map(({ label, features }) => (
							<React.Fragment key={label}>
								<tr className="bg-muted/30">
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
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}
