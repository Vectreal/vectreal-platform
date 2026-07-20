import { useAtom } from 'jotai/react'

import { SimplificationSettings } from './simplification-settings'
import { TextureSettings } from './texture-settings'
import { optimizationAtom } from '../../../../lib/stores/scene-optimization-store'
import { SettingToggle } from '../../settings-components'

import type { FC } from 'react'

const descriptions = {
	quantize: 'Reduces color precision to lower file size',
	dedup: 'Removes duplicate vertices and geometry',
	normals: 'Optimizes normal vectors for smoother appearance',
	draco: 'Compresses geometry with Draco (includes its own quantization)'
}

const tooltips = {
	quantize:
		'Reduces the number of bits used to store vertex positions and attributes, resulting in smaller file sizes but potentially introducing minor visual artifacts.',
	dedup:
		'Identifies and merges duplicate vertices, materials, and textures to reduce redundancy and decrease file size.',
	normals:
		'Recalculates and optimizes normal vectors to improve lighting appearance while reducing file size.',
	draco:
		'Applies Draco mesh compression, which can significantly reduce geometry size. Draco quantizes vertex attributes itself, so combining it with "Quantize Vertices" is redundant.'
}

const AdvancedPanel: FC = () => {
	const [{ optimizations }, setOptimizationState] = useAtom(optimizationAtom)

	const setEnabled = (
		checked: boolean,
		type: 'quantize' | 'dedup' | 'normals' | 'draco'
	) => {
		setOptimizationState((previousOptimizationState) => ({
			...previousOptimizationState,
			optimizations: {
				...previousOptimizationState.optimizations,
				[type]: {
					...previousOptimizationState.optimizations[type],
					enabled: checked
				}
			}
		}))
	}

	return (
		<div className="mx-auto w-full max-w-3xl space-y-5">
			<SimplificationSettings />
			<TextureSettings />

			<div className="bg-shell-surface-soft/50 space-y-4 rounded-xl p-4 shadow-sm">
				<SettingToggle
					enabled={optimizations.quantize.enabled}
					onToggle={(checked) => setEnabled(checked, 'quantize')}
					title="Quantize Vertices"
					description={descriptions.quantize}
					info={tooltips.quantize}
				/>
				<SettingToggle
					enabled={optimizations.dedup.enabled}
					onToggle={(checked) => setEnabled(checked, 'dedup')}
					title="Remove Duplicates"
					description={descriptions.dedup}
					info={tooltips.dedup}
				/>
				<SettingToggle
					enabled={optimizations.normals.enabled}
					onToggle={(checked) => setEnabled(checked, 'normals')}
					title="Optimize Normals"
					description={descriptions.normals}
					info={tooltips.normals}
				/>
				<SettingToggle
					enabled={optimizations.draco.enabled}
					onToggle={(checked) => setEnabled(checked, 'draco')}
					title="Compress Geometry (Draco)"
					description={descriptions.draco}
					info={tooltips.draco}
				/>
			</div>
		</div>
	)
}

export default AdvancedPanel
