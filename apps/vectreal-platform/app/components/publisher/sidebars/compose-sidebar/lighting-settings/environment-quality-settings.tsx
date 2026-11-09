import { Button } from '@shared/components/ui/button'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { useAtom, useAtomValue } from 'jotai/react'
import { Eye } from 'lucide-react'
import { useEffect } from 'react'

import { environmentQualityChoice, qualityLabel } from './environment-quality'
import {
	comparedEnvironmentQualityAtom,
	isComparingEnvironmentQualityAtom
} from '../../../../../lib/stores/publisher-config-store'
import { SettingGroup } from '../../sidebar-section'

import type { EnvironmentQuality, ResolvedLighting } from '@vctrl/core'

const QUALITIES: EnvironmentQuality[] = ['compressed', 'lossless']

interface EnvironmentQualitySettingsProps {
	environment: ResolvedLighting['environment']
	/** The scene names its own map rather than a hosted one. */
	hasOwnFiles: boolean
	onQualityChange: (quality: EnvironmentQuality) => void
}

/**
 * Which encoding of the map the scene loads, with what each downloads, and a
 * compare that shows the other one on the stage, so the author judges the
 * difference on their own model before choosing. The other map downloads on
 * the first compare, not before.
 *
 * A map with no compressed version shows lossless, fixed, and says why.
 */
export const EnvironmentQualitySettings = ({
	environment,
	hasOwnFiles,
	onQualityChange
}: EnvironmentQualitySettingsProps) => {
	const choice = environmentQualityChoice(environment, hasOwnFiles)
	const [isComparing, setIsComparing] = useAtom(
		isComparingEnvironmentQualityAtom
	)
	const comparedQuality = useAtomValue(comparedEnvironmentQualityAtom)
	const selected: EnvironmentQuality = choice.canCompress
		? environment.quality
		: 'lossless'

	// A compare ends with the panel, and with a map that has nothing to compare.
	useEffect(() => {
		if (!choice.canCompress) setIsComparing(false)
	}, [choice.canCompress, setIsComparing])
	useEffect(() => () => setIsComparing(false), [setIsComparing])

	return (
		<SettingGroup
			label="Quality"
			description={choice.caption}
			action={
				choice.canCompress && (
					<Button
						variant={isComparing ? 'secondary' : 'ghost'}
						size="sm"
						aria-pressed={isComparing}
						onClick={() => setIsComparing((value) => !value)}
						className="shell-focus -my-1 h-7 gap-1.5 px-2"
					>
						<Eye aria-hidden className="size-3.5" />
						Compare
					</Button>
				)
			}
		>
			<ToggleGroup
				type="single"
				aria-label="Environment quality"
				value={selected}
				disabled={!choice.canCompress}
				onValueChange={(value) => {
					if (value) onQualityChange(value as EnvironmentQuality)
				}}
			>
				{QUALITIES.map((quality) => (
					<ToggleGroupItem
						key={quality}
						value={quality}
						className="tabular-nums"
					>
						{qualityLabel(quality, choice.bytes[quality])}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{/* Announces what the stage shows as a compare starts and ends. */}
			<p role="status" className="sr-only">
				{choice.canCompress && `Showing ${comparedQuality ?? selected}`}
			</p>
		</SettingGroup>
	)
}
