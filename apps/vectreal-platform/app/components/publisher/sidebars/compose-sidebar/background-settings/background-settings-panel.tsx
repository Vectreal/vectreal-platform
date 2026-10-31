import { Slider, type SliderPreset } from '@shared/components/ui/slider'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { valueMappings } from '@shared/utils'
import { resolveLighting } from '@vctrl/core'
import { useState } from 'react'

import StageColorField from './stage-color-field'
import { DrillDown, DrillDownView } from '../../drill-down'
import {
	type BackgroundType,
	backgroundOfType
} from '../lighting-settings/lighting-edits'
import { useLightingDraft } from '../lighting-settings/use-lighting-draft'

const BACKGROUNDS: { type: BackgroundType; label: string }[] = [
	{ type: 'none', label: 'None' },
	{ type: 'color', label: 'Color' },
	{ type: 'gradient', label: 'Gradient' },
	{ type: 'environment', label: 'HDRI' }
]

const BACKGROUND_CAPTIONS: Record<BackgroundType, string> = {
	none: 'Nothing behind the model: an embed shows the page it sits on, and the ground shadow lands on it.',
	color:
		'A flat stage behind the model, for its shadow to land on. The environment still lights it.',
	gradient:
		'A stage that shades from top to bottom, for the shadow to land on. The environment still lights it.',
	environment:
		'The environment map fills the view behind the model. It has no floor, so a ground shadow has nothing to land on.'
}

const BLUR_PRESETS: SliderPreset[] = [
	{ value: 0, label: 'Sharp' },
	{ value: 0.3, label: 'Soft' },
	{ value: 0.8, label: 'Blurred' }
]

const BRIGHTNESS_PRESETS: SliderPreset[] = [
	{ value: 0.3, label: 'Dim' },
	{ value: 1, label: 'Normal' },
	{ value: 2.5, label: 'Bright' }
]

/**
 * What sits behind the model. It is stored with the lighting, which lights
 * the model whichever background is chosen, but it is a choice about the
 * page, so it has a tool of its own.
 */
const BackgroundSettings = () => {
	const { lighting, commit, preview } = useLightingDraft()
	const [path, setPath] = useState<string[]>([])
	const { background } = resolveLighting({ lighting })

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Background">
			<DrillDownView id="root" caption={BACKGROUND_CAPTIONS[background.type]}>
				<ToggleGroup
					type="single"
					aria-label="Background"
					value={background.type}
					onValueChange={(value) => {
						if (value)
							commit((prev) => ({
								...prev,
								background: backgroundOfType(
									value as BackgroundType,
									prev.background
								)
							}))
					}}
				>
					{BACKGROUNDS.map((entry) => (
						<ToggleGroupItem key={entry.type} value={entry.type}>
							{entry.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				{background.type === 'environment' && (
					<>
						<Slider
							label="Blur"
							min={0}
							max={1}
							step={0.01}
							presets={BLUR_PRESETS}
							value={background.blur ?? 0}
							onValueChange={(blur) =>
								preview((prev) => ({
									...prev,
									background: { ...background, blur }
								}))
							}
						/>
						<Slider
							label="Brightness"
							min={0}
							max={3}
							step={0.01}
							mapping={valueMappings.quadratic}
							presets={BRIGHTNESS_PRESETS}
							value={background.intensity ?? 1}
							onValueChange={(intensity) =>
								preview((prev) => ({
									...prev,
									background: { ...background, intensity }
								}))
							}
						/>
					</>
				)}

				{background.type === 'color' && (
					<StageColorField
						label="Color"
						value={background.color}
						onChange={(color) =>
							preview((prev) => ({
								...prev,
								background: { type: 'color', color }
							}))
						}
					/>
				)}

				{background.type === 'gradient' && (
					<>
						<StageColorField
							label="Top"
							value={background.top}
							onChange={(top) =>
								preview((prev) =>
									prev.background?.type === 'gradient'
										? { ...prev, background: { ...prev.background, top } }
										: prev
								)
							}
						/>
						<StageColorField
							label="Bottom"
							value={background.bottom}
							onChange={(bottom) =>
								preview((prev) =>
									prev.background?.type === 'gradient'
										? { ...prev, background: { ...prev.background, bottom } }
										: prev
								)
							}
						/>
					</>
				)}
			</DrillDownView>
		</DrillDown>
	)
}

export default BackgroundSettings
