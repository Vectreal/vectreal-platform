import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { Layers, Plus } from 'lucide-react'
import { memo, useCallback } from 'react'

import {
	processAtom
} from '../../../../../lib/stores/publisher-config-store'
import {
	objectOverridesAtom,
	sceneNodeNamesAtom
} from '../../../../../lib/stores/scene-settings-store'

import type { ObjectOverride } from '@vctrl/core'

function createDefaultOverride(nodeId: string): ObjectOverride {
	return {
		nodeId,
		enabled: true
	}
}

/**
 * ObjectListPanel — lists glTF nodes from the loaded scene document.
 * Each node can have an ObjectOverride created, switching to the overrides panel.
 */
const ObjectListPanel = memo(() => {
	const nodeNames = useAtomValue(sceneNodeNamesAtom)
	const overrides = useAtomValue(objectOverridesAtom)
	const setObjectOverrides = useSetAtom(objectOverridesAtom)
	const setProcess = useSetAtom(processAtom)

	const handleCreateOverride = useCallback(
		(nodeId: string) => {
			setObjectOverrides((prev) => {
				if (prev.some((o) => o.nodeId === nodeId)) {
					return prev
				}
				return [...prev, createDefaultOverride(nodeId)]
			})
			setProcess((prev) => ({
				...prev,
				activeObjectTool: 'object-overrides'
			}))
		},
		[setObjectOverrides, setProcess]
	)

	if (nodeNames.length === 0) {
		return (
			<div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
				<Layers className="h-8 w-8 opacity-40" />
				<p>No scene loaded.</p>
				<p className="text-xs opacity-70">
					Upload a 3D model to see its node list here.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-1">
			{nodeNames.map((name) => {
				const hasOverride = overrides.some((o) => o.nodeId === name)
				return (
					<div
						key={name}
						className="flex items-center justify-between rounded-lg px-2 py-1.5"
					>
						<span className="truncate text-sm font-mono">{name}</span>
						<div className="flex shrink-0 items-center gap-1.5">
							{hasOverride && (
								<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
									Override
								</Badge>
							)}
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								aria-label={
									hasOverride
										? `View override for ${name}`
										: `Create override for ${name}`
								}
								onClick={() => handleCreateOverride(name)}
							>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				)
			})}
		</div>
	)
})

ObjectListPanel.displayName = 'ObjectListPanel'

export default ObjectListPanel
