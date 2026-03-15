import { Button } from '@shared/components/ui/button'
import { useSetAtom } from 'jotai'
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
		<div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
			<Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
			<div className="space-y-2">
				<p className="font-semibold text-amber-900 dark:text-amber-100">
					{title}
				</p>
				<p className="text-sm text-amber-700 dark:text-amber-300">
					{description}
				</p>
				<Button type="button" onClick={openUpgradeModal}>
					Upgrade plan
				</Button>
			</div>
		</div>
	)
}
