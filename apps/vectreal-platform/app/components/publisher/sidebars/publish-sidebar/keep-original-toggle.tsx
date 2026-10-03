import { Toggle } from '@shared/components/ui/toggle'
import { formatFileSize } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'

import { MAX_STORED_FILE_BYTES } from '../../../../constants/utility-constants'
import {
	hasOriginalToKeep,
	isOriginalTooLargeToKeep
} from '../../../../lib/domain/scene/client/scene-source-to-save'
import {
	keptOriginalAtom,
	optimizationAtom
} from '../../../../lib/stores/scene-optimization-store'

/**
 * The author's choice to keep the original beside the optimized model.
 *
 * Shown only while there is an original worth keeping: the scene keeps one
 * already, or the model on screen was optimized from an untouched upload. Its
 * caption says why it matters and what it costs, since the original counts
 * toward storage.
 */
export function KeepOriginalToggle() {
	const [{ keep, stored, saved }, setKeptOriginal] = useAtom(keptOriginalAtom)
	const { sourceSettings, derivedFrom } = useAtomValue(optimizationAtom)
	const { optimizer } = useModelContext(true)

	const source = optimizer.getSource()
	const state = { stored, sourceSettings, derivedFrom, source }

	if (isOriginalTooLargeToKeep(state)) {
		return (
			<Toggle
				layout="row"
				label="Keep the original"
				description={`At ${formatFileSize(source?.byteLength ?? 0)} the original is over the ${formatFileSize(MAX_STORED_FILE_BYTES)} a single file can take, so it is not kept. Later changes start from the saved version.`}
				checked={false}
				disabled
			/>
		)
	}
	if (!hasOriginalToKeep(state)) return null

	const originalBytes = stored ? stored.byteSize : (source?.byteLength ?? null)
	const size =
		typeof originalBytes === 'number' ? formatFileSize(originalBytes) : null
	// A save re-links an original the scene already keeps, so it adds nothing.
	const cost = saved
		? size
			? `Already counted in your storage (${size}).`
			: 'Already counted in your storage.'
		: size
			? `Adds about ${size} to your storage.`
			: 'Counts toward your storage.'

	return (
		<Toggle
			layout="row"
			label="Keep the original"
			description={
				keep
					? `Lets you change the optimization later without losing quality. ${cost}`
					: saved
						? 'Saving removes the original this scene keeps. Later changes then start from the saved version.'
						: 'Later changes will start from the saved version, so quality you optimize away cannot come back.'
			}
			checked={keep}
			onCheckedChange={(next) =>
				setKeptOriginal((prev) => ({ ...prev, keep: next }))
			}
		/>
	)
}
