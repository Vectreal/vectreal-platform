import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom } from 'jotai/react'

import { resolveInteractionStart } from '../../../../lib/domain/scene/scene-presentation'
import { presentationAtom } from '../../../../lib/stores/scene-settings-store'
import { SettingGroup } from '../sidebar-section'

import type { SceneInteractionStart } from '@vctrl/core'

const STARTS: { value: SceneInteractionStart; label: string }[] = [
	{ value: 'immediate', label: 'Right away' },
	{ value: 'tap', label: 'After a tap' }
]

/** When visitors can start moving the scene. */
export const StartMovingSetting = () => {
	const [presentation, setPresentation] = useAtom(presentationAtom)
	const start = resolveInteractionStart(presentation)

	return (
		<SettingGroup
			label="Start moving"
			description={
				start === 'tap'
					? 'Visitors tap "Tap to rotate" first, so the page or product gallery around the scene keeps scrolling. Applies to embeds and preview links as soon as you save.'
					: 'Visitors can move the scene as soon as it appears. Applies to embeds and preview links as soon as you save.'
			}
		>
			<ToggleGroup
				type="single"
				aria-label="Start moving"
				value={start}
				onValueChange={(value) => {
					if (value)
						setPresentation((previous) => ({
							...previous,
							interactionStart: value as SceneInteractionStart
						}))
				}}
			>
				{STARTS.map(({ value, label }) => (
					<ToggleGroupItem key={value} value={value}>
						{label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</SettingGroup>
	)
}
