import {
	SelectItem,
	SelectContent,
	SelectTrigger,
	SelectValue,
	Select,
	Button
} from '@shared/components'
import { AnimatePresence, motion } from 'framer-motion'
import { useSetAtom, useAtom, useAtomValue } from 'jotai'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import {
	isPreviewModeAtom,
	processAtom
} from '../../../lib/stores/publisher-config-store'
import {
	cameraAtom,
	selectedCameraIdAtom
} from '../../../lib/stores/scene-settings-store'

const PreviewCameraControls: React.FC = () => {
	const [isPreviewMode, setIsPreviewMode] = useAtom(isPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
	const { cameras } = useAtomValue(cameraAtom)
	const [selectedCameraId, setSelectedCameraId] = useAtom(selectedCameraIdAtom)

	const sceneCameras = useMemo(
		() =>
			(cameras ?? []).filter(
				(cameraEntry) => !cameraEntry.kind || cameraEntry.kind === 'scene'
			),
		[cameras]
	)

	const activePreviewCameraIndex = useMemo(() => {
		if (!sceneCameras.length) return -1
		const selectedIndex = sceneCameras.findIndex(
			(cameraEntry) => cameraEntry.cameraId === selectedCameraId
		)
		return selectedIndex >= 0 ? selectedIndex : 0
	}, [sceneCameras, selectedCameraId])

	const activePreviewCamera =
		activePreviewCameraIndex >= 0
			? sceneCameras[activePreviewCameraIndex]
			: null

	const handleSelectPreviewCamera = useCallback(
		(nextCameraId: string) => {
			setSelectedCameraId(nextCameraId)
		},
		[setSelectedCameraId]
	)

	const handleCyclePreviewCamera = useCallback(
		(direction: -1 | 1) => {
			if (!sceneCameras.length) {
				return
			}

			const currentIndex =
				activePreviewCameraIndex >= 0 ? activePreviewCameraIndex : 0
			const nextIndex =
				(currentIndex + direction + sceneCameras.length) % sceneCameras.length

			setSelectedCameraId(sceneCameras[nextIndex].cameraId)
		},
		[activePreviewCameraIndex, sceneCameras, setSelectedCameraId]
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
					className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex justify-center px-4"
				>
					<div className="pointer-events-auto relative">
						<motion.button
							type="button"
							onClick={handleExitPreviewMode}
							aria-label="Exit preview mode"
							className="bg-accent text-accent-foreground border-border/70 hover:text-foreground absolute -top-8 left-1/2 z-0 h-10 -translate-x-1/2 rounded-t-xl border border-b-0 px-3 pt-2 pb-3 text-xs shadow-lg"
							whileHover={{ y: -2 }}
							whileTap={{ y: 0 }}
						>
							<span className="flex items-center gap-1.5">Exit Preview</span>
						</motion.button>

						<div className="bg-muted/92 border-border/70 relative z-10 flex items-center gap-2 rounded-2xl border px-2 py-1.5 shadow-2xl backdrop-blur-2xl">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-xl"
								onClick={() => handleCyclePreviewCamera(-1)}
								aria-label="Previous camera"
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>

							<Select
								value={activePreviewCamera?.cameraId ?? ''}
								onValueChange={handleSelectPreviewCamera}
							>
								<SelectTrigger className="h-8 min-w-44 rounded-xl text-xs">
									<SelectValue placeholder="Select camera" />
								</SelectTrigger>
								<SelectContent>
									{sceneCameras.map((cameraEntry) => (
										<SelectItem
											key={cameraEntry.cameraId}
											value={cameraEntry.cameraId}
										>
											{cameraEntry.name || 'Unnamed Camera'}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-xl"
								onClick={() => handleCyclePreviewCamera(1)}
								aria-label="Next camera"
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	)
}

export default PreviewCameraControls
