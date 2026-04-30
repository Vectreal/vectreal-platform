import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from '@shared/components/ui/button'
import { useAtomValue } from 'jotai/react'
import {
	CircleFadingArrowUp,
	Cloud,
	LoaderCircle,
	Sparkles
} from 'lucide-react'

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
	compact?: boolean
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
	compact = false,
	onRequireAuth,
	saveSceneSettings
}: SaveButtonProps) => {
	const isSaving = useAtomValue(isSavingAtom)
	const shouldReduceMotion = useReducedMotion()
	const { handleSaveScene } = usePublisherSaveAction({
		sceneId,
		userId,
		saveLocationTarget,
		onRequireAuth,
		saveSceneSettings
	})

	const isSaveDisabled = userId
		? isSaving || !saveAvailability.canSave
		: isSaving

	const saveVisual = isSaving
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
			: saveAvailability.reason === 'requires-first-optimization'
				? {
						key: 'optimize-first',
						label: 'Optimize First',
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

	const contentTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: [0.2, 1, 0.3, 1] }

	const contentMotion = shouldReduceMotion
		? undefined
		: {
				initial: { opacity: 0, y: 3 },
				animate: { opacity: 1, y: 0 },
				exit: { opacity: 0, y: -3 }
			}

	return (
		<Button
			variant="ghost"
			size={compact ? 'icon' : undefined}
			className={
				compact
					? 'flex items-center justify-center rounded-xl'
					: 'flex w-[10.75rem] items-center justify-start gap-2.5 rounded-xl px-4'
			}
			aria-label={saveVisual.label}
			disabled={isSaveDisabled}
			onClick={handleSaveScene}
		>
			<span className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden">
				<AnimatePresence initial={false} mode="wait">
					<motion.span
						key={saveVisual.key}
						className="absolute inset-0 flex items-center justify-center"
						transition={contentTransition}
						{...(contentMotion ?? {})}
					>
						{saveVisual.icon}
					</motion.span>
				</AnimatePresence>
			</span>
			{!compact ? (
				<motion.span
					layout="position"
					className="grid min-w-0 flex-1 overflow-hidden text-left"
				>
					<AnimatePresence initial={false} mode="wait">
						<motion.span
							key={saveVisual.key}
							className="truncate"
							transition={contentTransition}
							{...(contentMotion ?? {})}
						>
							{saveVisual.label}
						</motion.span>
					</AnimatePresence>
				</motion.span>
			) : null}
		</Button>
	)
}

export default SaveButton
