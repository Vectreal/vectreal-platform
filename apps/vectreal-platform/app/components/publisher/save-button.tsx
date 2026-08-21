import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { useReducedMotion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import {
	Check,
	CircleFadingArrowUp,
	Cloud,
	LoaderCircle,
	Sparkles
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { usePublisherSaveAction } from '../../hooks/use-publisher-save-action'
import { isSavingAtom } from '../../lib/stores/publisher-config-store'

import type { SaveAvailabilityState } from '../../lib/domain/scene'
import type {
	SaveLocationTarget,
	SaveSceneResult
} from '../../types/publisher-scene'

interface SaveButtonProps {
	sceneId: null | string
	userId?: string
	saveLocationTarget: SaveLocationTarget
	saveAvailability: SaveAvailabilityState
	forceDisabled?: boolean
	onRequireAuth?: () => Promise<void> | void
	saveSceneSettings: (
		target?: SaveLocationTarget
	) => Promise<SaveSceneResult | { unchanged: true } | undefined>
}

const SaveButton = ({
	sceneId,
	userId,
	saveLocationTarget,
	saveAvailability,
	forceDisabled = false,
	onRequireAuth,
	saveSceneSettings
}: SaveButtonProps) => {
	const isSaving = useAtomValue(isSavingAtom)
	const shouldReduceMotion = useReducedMotion()
	const prevSavingRef = useRef(isSaving)
	const [justSaved, setJustSaved] = useState(false)

	useEffect(() => {
		const wasJustSaved = prevSavingRef.current && !isSaving
		prevSavingRef.current = isSaving
		if (!wasJustSaved) return
		setJustSaved(true)
		const timer = setTimeout(() => setJustSaved(false), 1800)
		return () => clearTimeout(timer)
	}, [isSaving])

	const { handleSaveScene } = usePublisherSaveAction({
		sceneId,
		userId,
		saveLocationTarget,
		onRequireAuth,
		saveSceneSettings
	})

	const isSaveDisabled = userId
		? forceDisabled || isSaving || !saveAvailability.canSave
		: forceDisabled || isSaving

	const saveVisual = justSaved
		? {
				key: 'just-saved',
				label: 'Saved',
				icon: <Check size={16} className="inline" />
			}
		: isSaving
			? {
					key: 'saving',
					label: 'Saving...',
					icon: <LoaderCircle size={16} className="inline animate-spin" />
				}
			: !userId
				? {
						key: 'auth',
						label: 'Sign In to Save',
						icon: <CircleFadingArrowUp size={16} className="inline" />
					}
				: saveAvailability.reason === 'requires-size-reduction'
					? {
							key: 'reduce-size',
							label: 'Optimize to Save',
							icon: <Sparkles size={16} className="inline animate-pulse" />
						}
					: saveAvailability.reason === 'no-unsaved-changes'
						? {
								key: 'saved',
								label: 'Saved',
								icon: <Cloud size={16} className="inline" />
							}
						: {
								key: 'ready',
								label: 'Save',
								icon: <CircleFadingArrowUp size={16} className="inline" />
							}

	/**
	 * The swap is a keyed remount with a CSS enter animation rather than an
	 * `AnimatePresence` cross-fade: presence animations hold the outgoing content
	 * until an exit lands on framer's rAF loop, and a throttled loop (background
	 * tab, a heavy frame) left the button reading "Save" while it was already
	 * disabled. What the button says has to follow from its state alone.
	 */
	const contentAnimation = shouldReduceMotion
		? undefined
		: 'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.2,1,0.3,1)]'

	return (
		<Button
			variant="ghost"
			// Icon-only where the header is tight, labelled once there is room.
			className={cn(
				'flex items-center justify-center gap-0 rounded-xl px-0',
				'sm:justify-start sm:gap-2.5 sm:px-4',
				justSaved && 'text-emerald-500 dark:text-emerald-400'
			)}
			aria-label={saveVisual.label}
			disabled={isSaveDisabled}
			onClick={handleSaveScene}
		>
			<span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
				<span
					key={saveVisual.key}
					className={cn(
						'absolute inset-0 flex items-center justify-center',
						contentAnimation
					)}
				>
					{saveVisual.icon}
				</span>
			</span>
			<span className="hidden min-w-0 flex-1 overflow-hidden text-left sm:grid">
				<span key={saveVisual.key} className={cn('truncate', contentAnimation)}>
					{saveVisual.label}
				</span>
			</span>
		</Button>
	)
}

export default SaveButton
