import { ChoiceList } from '@shared/components/ui/choice-list'
import { Check, Feather, Gem, Scale, Undo2 } from 'lucide-react'

import { optimizationPresets } from '../../../../constants/optimizations'
import { InlineNotice } from '../../../layout-components'
import { getOptimizationDefinition, listEnabledKeys } from '../model'
import { useOptimizationSettings } from '../use-optimization-settings'

import type { PresetId } from '../../../../types/scene-optimization'
import type { Optimizations } from '@vctrl/core'
import type { FC, SVGProps } from 'react'

interface PresetMeta {
	icon: FC<SVGProps<SVGSVGElement>>
	label: string
	description: string
}

export const PRESET_META: Record<PresetId, PresetMeta> = {
	original: {
		icon: Undo2,
		label: 'Original',
		description:
			'Your model exactly as uploaded. Nothing runs, so nothing is lost, and every other preset is made from this.'
	},
	quality: {
		icon: Gem,
		label: 'Maximum quality',
		description:
			'Keeps textures large and detail intact. Best for hero shots and close inspection, at the cost of a bigger download.'
	},
	balanced: {
		icon: Scale,
		label: 'Balanced',
		description:
			'The trade-off most scenes want: sharp on desktop, quick to load, no visible loss at normal viewing distance.'
	},
	smallest: {
		icon: Feather,
		label: 'Smallest',
		description:
			'Smallest file and fastest first paint. Best for mobile, slow connections, and scenes viewed at a distance.'
	}
}

const PRESET_ORDER: PresetId[] = ['original', 'quality', 'balanced', 'smallest']

/**
 * Reads the summary off the preset itself, so a card can never advertise a
 * technique the preset does not actually run. These used to be hand-written
 * arrays that had already fallen out of date.
 */
function describePreset(preset: PresetId) {
	const optimizations = optimizationPresets[preset]
	const { enabled, resize, quality } = optimizations.texture
	const [width] = resize ?? []
	const resolution = width
		? `${width >= 1024 ? `${width / 1024}K` : width}px · `
		: ''

	return {
		summary: enabled ? `${resolution}${quality ?? 0}%` : 'Unchanged',
		techniques: listEnabledKeys(optimizations).map(
			(key) => getOptimizationDefinition(key).title
		)
	}
}

interface PresetPanelProps {
	/** Derives the chosen preset from the original, so a choice applies at once. */
	onChoose: (optimizations: Optimizations) => void
	/**
	 * The source is a saved, already-optimized document rather than the upload,
	 * so the first choice is that saved version and must not claim otherwise.
	 */
	sourceIsSaved: boolean
}

const SAVED_VERSION_META: PresetMeta = {
	icon: Undo2,
	label: 'Saved version',
	description:
		'This scene as it was saved. Its original upload was not kept, so every preset is made from this.'
}

/**
 * The presets, starting with the original itself. The one in effect opens to
 * say what it is for and which steps it runs; settings that match none of them
 * select nothing and say so.
 */
export const PresetPanel: FC<PresetPanelProps> = ({
	onChoose,
	sourceIsSaved
}) => {
	const { optimizationPreset, selectPreset } = useOptimizationSettings()

	const options = PRESET_ORDER.map((id) => {
		const meta =
			id === 'original' && sourceIsSaved ? SAVED_VERSION_META : PRESET_META[id]
		const { summary, techniques } = describePreset(id)
		const Icon = meta.icon
		return {
			value: id,
			label: meta.label,
			icon: <Icon />,
			meta: summary,
			detail: (
				<>
					<span className="block leading-relaxed">{meta.description}</span>
					{techniques.length > 0 && (
						<>
							<span className="text-eyebrow mt-3 mb-2 block opacity-70">
								Applied techniques
							</span>
							<span className="flex flex-col gap-1.5">
								{techniques.map((technique) => (
									<span key={technique} className="flex items-center gap-2">
										<Check aria-hidden className="size-3 shrink-0" />
										{technique}
									</span>
								))}
							</span>
						</>
					)}
				</>
			)
		}
	})

	return (
		<div className="space-y-2">
			<ChoiceList
				aria-label="Optimization preset"
				options={options}
				value={optimizationPreset === 'custom' ? undefined : optimizationPreset}
				onValueChange={(id) => {
					selectPreset(id, optimizationPresets[id])
					onChoose(optimizationPresets[id])
				}}
			/>

			{/*
			  Settings that match no preset used to fall back to the middle card,
			  which left it highlighted as though it were still in effect.
			*/}
			{optimizationPreset === 'custom' && (
				<InlineNotice tone="neutral">
					Custom settings that match no preset. Pick one above to reset them.
				</InlineNotice>
			)}
		</div>
	)
}

export default PresetPanel
