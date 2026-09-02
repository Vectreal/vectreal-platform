import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useMemo } from 'react'

import { PUBLISHER_LAYER } from './shell/shell-layout'
import { isSceneCamera } from '../../lib/domain/scene/scene-camera'
import { isPreviewModeAtom } from '../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	selectedCameraIdAtom
} from '../../lib/stores/scene-settings-store'
import CameraSwitcherPill from '../scene-embed/preview-chrome/camera-switcher-pill'

const PreviewCameraControls: React.FC = () => {
	const isPreviewMode = useAtomValue(isPreviewModeAtom)
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

	return (
		<AnimatePresence>
			{isPreviewMode && sceneCameras.length > 0 ? (
				<motion.div
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ type: 'spring', stiffness: 320, damping: 28 }}
					className={cn(
						'pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3',
						PUBLISHER_LAYER.previewControls
					)}
				>
					{/*
					  Exiting lives on the preview frame now, not here. It has to be
					  reachable even when a scene has no cameras, and this component
					  renders nothing in that case.
					*/}
					<CameraSwitcherPill
						className="pointer-events-auto"
						cameras={sceneCameras}
						activeCameraId={selectedCameraId ?? null}
						onSelect={handleSelectPreviewCamera}
					/>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

export default PreviewCameraControls
