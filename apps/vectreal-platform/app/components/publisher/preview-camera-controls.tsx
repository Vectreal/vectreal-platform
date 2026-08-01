import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useSetAtom, useAtom, useAtomValue } from 'jotai'
import { useCallback, useMemo } from 'react'

import { PUBLISHER_LAYER } from './shell/shell-layout'
import { isSceneCamera } from '../../lib/domain/scene/scene-camera'
import {
	isPreviewModeAtom,
	processAtom
} from '../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	selectedCameraIdAtom
} from '../../lib/stores/scene-settings-store'
import CameraSwitcherPill from '../scene-embed/preview-chrome/camera-switcher-pill'

const PreviewCameraControls: React.FC = () => {
	const [isPreviewMode, setIsPreviewMode] = useAtom(isPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
	const { cameras } = useAtomValue(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)

	const sceneCameras = useMemo(
		() => (cameras ?? []).filter(isSceneCamera),
		[cameras]
	)

	const handleSelectPreviewCamera = useCallback(
		(nextCameraId: string) => {
			setSelectedCameraId(nextCameraId)
		},
		[setSelectedCameraId]
	)

	const handleExitPreviewMode = useCallback(() => {
		setIsPreviewMode(false)
		setProcessState((prev) => ({
			...prev,
			mode: 'compose',
			activeComposeTool: 'camera-controls',
			showSidebar: true,
			showPublishPanel: false
		}))
	}, [setIsPreviewMode, setProcessState])

	return (
		<AnimatePresence>
			{isPreviewMode && sceneCameras.length > 0 ? (
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ type: 'spring', stiffness: 320, damping: 28 }}
					className={cn(
						"pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3",
						PUBLISHER_LAYER.previewControls
					)}
				>
					<div className="pointer-events-auto relative">
						<motion.button
							type="button"
							onClick={handleExitPreviewMode}
							aria-label="Exit preview mode"
							className="bg-orange text-white border-border/70 hover:text-foreground absolute -top-8 left-1/2 z-0 h-10 -translate-x-1/2 rounded-t-xl border border-b-0 px-3 pt-2 pb-3 text-xs shadow-lg"
							whileHover={{ y: -2 }}
							whileTap={{ y: 0 }}
						>
							<span className="flex items-center gap-1.5">Exit Preview</span>
						</motion.button>

						<CameraSwitcherPill
							className="relative z-10"
							cameras={sceneCameras}
							activeCameraId={selectedCameraId ?? null}
							onSelect={handleSelectPreviewCamera}
						/>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

export default PreviewCameraControls
