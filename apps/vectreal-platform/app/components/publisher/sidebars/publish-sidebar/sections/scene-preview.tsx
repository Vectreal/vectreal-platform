import { Button } from '@shared/components/ui/button'
import { motion } from 'framer-motion'
import { useAtomValue } from 'jotai/react'
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react'

import { sceneMetaAtom } from '../../../../../lib/stores/publisher-config-store'
import { useOpeningViewCapture } from '../../../shell/use-opening-view'

import type { FC } from 'react'

/**
 * The full-size look at what will be published, and the frame the scene opens
 * on — they are the same thing, since the thumbnail is the placeholder shown
 * while the scene loads.
 *
 * Larger than the publish card's thumbnail on purpose: the card is an identity
 * marker you glance at, while this is where the framing actually gets verified
 * before shipping. That is also why the control is a labelled button here
 * rather than the card's hover affordance.
 */
export const ScenePreview: FC = () => {
	const { thumbnailUrl } = useAtomValue(sceneMetaAtom)
	const { setOpeningView, isCapturing } = useOpeningViewCapture()

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
			className="space-y-3"
		>
			<div className="publisher-shell-nested relative aspect-video w-full overflow-hidden rounded-xl">
				{thumbnailUrl ? (
					<img
						src={thumbnailUrl}
						alt="Scene opening view"
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full flex-col items-center justify-center gap-2">
						<ImageIcon className="text-muted-foreground/40 h-7 w-7" />
						<p className="text-muted-foreground text-xs">
							No opening view set yet
						</p>
					</div>
				)}
			</div>

			<Button
				type="button"
				variant="secondary"
				size="sm"
				className="w-full"
				disabled={isCapturing}
				onClick={setOpeningView}
			>
				{isCapturing ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<Camera className="h-3.5 w-3.5" />
				)}
				Set opening view to current camera
			</Button>

			<p className="text-muted-foreground text-xs leading-relaxed">
				Sets both the thumbnail and the camera the scene opens on, so the
				placeholder shown while loading matches the first frame viewers see.
			</p>
		</motion.div>
	)
}
