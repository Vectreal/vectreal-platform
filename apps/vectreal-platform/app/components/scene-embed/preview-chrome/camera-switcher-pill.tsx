import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components'
import { cn } from '@shared/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo } from 'react'

export interface CameraSwitcherOption {
	cameraId: string
	name?: null | string
}

export interface CameraSwitcherPillProps {
	cameras: CameraSwitcherOption[]
	activeCameraId: null | string
	onSelect: (cameraId: string) => void
	className?: string
}

/**
 * `‹ Camera name ›` in a floating pill.
 *
 * Presentational on purpose: the publisher drives it from jotai atoms and the
 * internal preview drives it from the viewer's own `camera_changed` events. Two
 * data sources, one visual, so switching cameras looks identical in both.
 */
const CameraSwitcherPill = ({
	cameras,
	activeCameraId,
	onSelect,
	className
}: CameraSwitcherPillProps) => {
	// Falling back to the first camera keeps the control labelled before the
	// viewer has reported which camera it opened on.
	const activeIndex = useMemo(() => {
		if (!cameras.length) return -1
		const index = cameras.findIndex(
			(camera) => camera.cameraId === activeCameraId
		)
		return index >= 0 ? index : 0
	}, [cameras, activeCameraId])

	const activeCamera = activeIndex >= 0 ? cameras[activeIndex] : null

	const cycle = useCallback(
		(direction: -1 | 1) => {
			if (!cameras.length) return

			const currentIndex = activeIndex >= 0 ? activeIndex : 0
			const nextIndex =
				(currentIndex + direction + cameras.length) % cameras.length

			onSelect(cameras[nextIndex].cameraId)
		},
		[activeIndex, cameras, onSelect]
	)

	const isCyclable = cameras.length > 1

	return (
		<div
			className={cn(
				'bg-muted/92 border-border/70 flex items-center gap-2 rounded-2xl border px-2 py-1.5 shadow-2xl backdrop-blur-2xl',
				className
			)}
		>
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 rounded-xl"
				onClick={() => cycle(-1)}
				disabled={!isCyclable}
				aria-label="Previous camera"
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			<Select value={activeCamera?.cameraId ?? ''} onValueChange={onSelect}>
				<SelectTrigger className="h-8 min-w-44 rounded-xl text-xs">
					<SelectValue placeholder="Select camera" />
				</SelectTrigger>
				<SelectContent>
					{cameras.map((camera) => (
						<SelectItem key={camera.cameraId} value={camera.cameraId}>
							{camera.name || 'Unnamed Camera'}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 rounded-xl"
				onClick={() => cycle(1)}
				disabled={!isCyclable}
				aria-label="Next camera"
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	)
}

export default CameraSwitcherPill
