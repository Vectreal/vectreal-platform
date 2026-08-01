import { Button } from '@shared/components'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import CameraSwitcherPill, {
	type CameraSwitcherOption
} from './camera-switcher-pill'
import PreviewExitBadge from './preview-exit-badge'
import { useChromeVisibility } from './use-chrome-visibility'

export interface PreviewChromeProps {
	/** Where Back and Escape land. Always the scene's dashboard page. */
	backTo: string
	cameras: CameraSwitcherOption[]
	activeCameraId: null | string
	onSelectCamera: (cameraId: string) => void
}

const PILL_SURFACE =
	'bg-muted/92 border-border/70 rounded-2xl border shadow-2xl backdrop-blur-2xl'

/**
 * The internal preview's overlay: leave, switch camera, get out of the way.
 *
 * Only `/preview` renders this. `/embed` cannot, because it is a different
 * route with a different layout, which is the point of the split.
 *
 * Placement keeps the viewer's own info popover (bottom-right) clear: leaving
 * and hiding sit on the top edge, cameras along the bottom-center.
 */
const PreviewChrome = ({
	backTo,
	cameras,
	activeCameraId,
	onSelectCamera
}: PreviewChromeProps) => {
	const navigate = useNavigate()
	const prefersReducedMotion = useReducedMotion()

	const handleExit = useCallback(() => {
		// Deliberately not history.back(): a preview link pasted into Slack has no
		// history to return to, and should still land on the scene it previews.
		void navigate(backTo)
	}, [backTo, navigate])

	const { isVisible, show, toggle } = useChromeVisibility({
		onExit: handleExit
	})

	const fade = prefersReducedMotion
		? { duration: 0 }
		: { duration: 0.18, ease: 'easeOut' as const }

	const offset = prefersReducedMotion ? 0 : 8

	return (
		<div className="pointer-events-none absolute inset-0 z-50">
			<AnimatePresence initial={false}>
				{isVisible ? (
					<motion.div
						key="chrome"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={fade}
					>
						<motion.div
							className="pointer-events-auto absolute top-3 left-3"
							initial={{ y: -offset }}
							animate={{ y: 0 }}
							exit={{ y: -offset }}
							transition={fade}
						>
							{/* Same badge the publisher's in-canvas preview uses, so
							    leaving a preview looks the same wherever you are. */}
							<PreviewExitBadge
								exitLabel="Back to scene"
								onExit={handleExit}
							/>
						</motion.div>

						<motion.div
							className="pointer-events-auto absolute top-3 right-3"
							initial={{ y: -offset }}
							animate={{ y: 0 }}
							exit={{ y: -offset }}
							transition={fade}
						>
							<Button
								variant="ghost"
								size="icon"
								onClick={toggle}
								aria-label="Hide preview controls (H)"
								title="Hide controls (H)"
								className={cn(PILL_SURFACE, 'h-10 w-10')}
							>
								<EyeOff className="h-4 w-4" />
							</Button>
						</motion.div>

						{cameras.length > 0 ? (
							<motion.div
								className="pointer-events-auto absolute inset-x-0 bottom-3 flex justify-center px-3"
								initial={{ y: offset }}
								animate={{ y: 0 }}
								exit={{ y: offset }}
								transition={fade}
							>
								<CameraSwitcherPill
									cameras={cameras}
									activeCameraId={activeCameraId}
									onSelect={onSelectCamera}
								/>
							</motion.div>
						) : null}
					</motion.div>
				) : (
					// Hiding the chrome must not strand anyone. This stays on screen at
					// low contrast and resolves into a real control on hover or focus.
					<motion.div
						key="restore"
						className="pointer-events-auto absolute top-3 right-3"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={fade}
					>
						<Button
							variant="ghost"
							size="icon"
							onClick={show}
							aria-label="Show preview controls (H)"
							title="Show controls (H)"
							className={cn(
								PILL_SURFACE,
								'h-10 w-10 opacity-25 transition-opacity duration-200',
								'hover:opacity-100 focus-visible:opacity-100'
							)}
						>
							<Eye className="h-4 w-4" />
						</Button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default PreviewChrome
