import { Button } from '@shared/components/ui/button'
import { useSetAtom } from 'jotai/react'
import { Lock } from 'lucide-react'

import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../lib/stores/upgrade-modal-store'

import type { Plan } from '../../constants/plan-config'

interface FeatureUnavailablePanelProps {
	title: string
	description: string
	plan?: Plan | null
	upgradeTo?: Plan | null
	actionAttempted: string
}

export function FeatureUnavailablePanel({
	title,
	description,
	plan,
	upgradeTo,
	actionAttempted
}: FeatureUnavailablePanelProps) {
	const setUpgradeModal = useSetAtom(upgradeModalAtom)

	const openUpgradeModal = () => {
		setUpgradeModal(
			buildUpgradeModalState({
				reason: 'feature_not_available',
				message: description,
				plan: plan ?? undefined,
				upgradeTo,
				actionAttempted
			})
		)
	}

	return (
		<div className="border-warning-border bg-warning-bg mb-6 flex items-start gap-3 rounded-lg border p-4">
			<Lock className="text-warning mt-0.5 h-5 w-5 shrink-0" />
			<div className="space-y-2">
				<p className="text-warning-foreground font-semibold">{title}</p>
				<p className="text-warning-muted-foreground text-sm">{description}</p>
				<Button type="button" onClick={openUpgradeModal}>
					Upgrade plan
				</Button>
			</div>
		</div>
	)
}
