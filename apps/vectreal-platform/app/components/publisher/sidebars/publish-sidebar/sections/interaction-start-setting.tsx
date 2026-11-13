import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'

import { resolveInteractionStart } from '../../../../../lib/domain/scene/scene-presentation'
import { SettingGroup } from '../../sidebar-section'

import type {
	SceneInteractionStart,
	SceneLocale,
	ScenePresentationSettings
} from '@vctrl/core'

const STARTS: { value: SceneInteractionStart; label: string }[] = [
	{ value: 'immediate', label: 'Right away' },
	{ value: 'tap', label: 'After a tap' }
]

const LANGUAGES: { value: SceneLocale | 'browser'; label: string }[] = [
	{ value: 'browser', label: 'Browser' },
	{ value: 'en', label: 'English' },
	{ value: 'de', label: 'Deutsch' }
]

interface InteractionStartSettingProps {
	presentation: ScenePresentationSettings
	onChange: (
		update: (previous: ScenePresentationSettings) => ScenePresentationSettings
	) => void
}

/**
 * When visitors can start moving the scene, and, when that waits for a tap,
 * the language of the button they tap.
 */
export const InteractionStartSetting = ({
	presentation,
	onChange
}: InteractionStartSettingProps) => {
	const start = resolveInteractionStart(presentation)

	return (
		<>
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
							onChange((previous) => ({
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
			{start === 'tap' && (
				<SettingGroup
					label="Button language"
					description={`"Tap to rotate" or "Zum Drehen tippen". Browser picks by each visitor's language.`}
				>
					<ToggleGroup
						type="single"
						aria-label="Button language"
						value={presentation.locale ?? 'browser'}
						onValueChange={(value) => {
							if (!value) return
							onChange(({ locale: _previous, ...rest }) =>
								value === 'browser'
									? rest
									: { ...rest, locale: value as SceneLocale }
							)
						}}
					>
						{LANGUAGES.map(({ value, label }) => (
							<ToggleGroupItem key={value} value={value}>
								{label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</SettingGroup>
			)}
		</>
	)
}
