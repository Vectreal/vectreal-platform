import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { matchViewerLocale } from '@vctrl/core'

import { SettingGroup } from '../../sidebar-section'

import type { SceneLocale, ScenePresentationSettings } from '@vctrl/core'

const LANGUAGES: { value: SceneLocale | 'browser'; label: string }[] = [
	{ value: 'browser', label: 'Browser' },
	{ value: 'en', label: 'English' },
	{ value: 'de', label: 'Deutsch' }
]

interface ViewerLanguageSettingProps {
	presentation: ScenePresentationSettings
	onChange: (
		update: (previous: ScenePresentationSettings) => ScenePresentationSettings
	) => void
}

/**
 * The language of the viewer's own words: the tap button, the first-time hint
 * and "How to move".
 */
export const ViewerLanguageSetting = ({
	presentation,
	onChange
}: ViewerLanguageSettingProps) => (
	<SettingGroup
		label="Viewer language"
		description={`The viewer's own words: the tap button ("Tap to rotate" or "Zum Drehen tippen"), the first-time hint and How to move. Browser picks by each visitor's language.`}
	>
		<ToggleGroup
			type="single"
			aria-label="Viewer language"
			// A tag set through the API, such as `de-AT`, shows as its language.
			value={matchViewerLocale(presentation.locale) ?? 'browser'}
			onValueChange={(value) => {
				if (!value) return
				onChange(({ locale: _previous, ...rest }) =>
					value === 'browser' ? rest : { ...rest, locale: value as SceneLocale }
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
)
