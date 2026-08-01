import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger
} from '@shared/components'
import { cn } from '@shared/utils'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

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
 * Below this, stepping through is faster than opening a list, so the name is
 * plain text and a dropdown affordance would be promising something pointless.
 */
const LIST_THRESHOLD = 3

/**
 * `‹ Camera name  2/5 ›` in a floating pill.
 *
 * Presentational on purpose: the publisher drives it from jotai atoms and the
 * internal preview from the viewer's own `camera_changed` events. Two data
 * sources, one visual.
 *
 * There is deliberately no select control here. A bordered field sitting on the
 * pill's matte surface reads as stuck on rather than part of it, and at the same
 * value as its container the border has to do all the work of separating them.
 * Arrows are the real action, so they carry the control, the name is quiet text,
 * and the counter supplies the orientation a dropdown only implied.
 */
const CameraSwitcherPill = ({
	cameras,
	activeCameraId,
	onSelect,
	className
}: CameraSwitcherPillProps) => {
	const [isListOpen, setIsListOpen] = useState(false)

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

	const handleSelect = useCallback(
		(cameraId: string) => {
			onSelect(cameraId)
			setIsListOpen(false)
		},
		[onSelect]
	)

	const isCyclable = cameras.length > 1
	const hasList = cameras.length > LIST_THRESHOLD
	const activeName = activeCamera?.name || 'Unnamed Camera'

	const label = (
		<>
			{/* Announced on change so the camera is not a purely visual state. */}
			<span className="truncate" aria-live="polite">
				{activeName}
			</span>
			{isCyclable ? (
				<span className="text-muted-foreground text-[11px] tabular-nums">
					{activeIndex + 1}/{cameras.length}
				</span>
			) : null}
		</>
	)

	return (
		<div
			className={cn(
				'bg-muted/92 border-border/70 flex items-center gap-0.5 rounded-2xl border p-1 shadow-2xl backdrop-blur-2xl',
				className
			)}
		>
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0 rounded-xl"
				onClick={() => cycle(-1)}
				disabled={!isCyclable}
				aria-label="Previous camera"
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			{hasList ? (
				<Popover open={isListOpen} onOpenChange={setIsListOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							className="h-8 min-w-40 justify-center gap-2 rounded-xl px-3 text-xs font-medium"
							aria-label={`Camera: ${activeName}. Choose a camera`}
						>
							{label}
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="center"
						sideOffset={8}
						className="bg-muted/92 border-border/70 w-56 rounded-2xl border p-1 shadow-2xl backdrop-blur-2xl"
					>
						<div role="listbox" aria-label="Cameras">
							{cameras.map((camera, index) => {
								const isActive = index === activeIndex
								return (
									<button
										key={camera.cameraId}
										type="button"
										role="option"
										aria-selected={isActive}
										onClick={() => handleSelect(camera.cameraId)}
										className={cn(
											// A neutral tint rather than `bg-accent`: this is a glass
									// surface floating over the scene, and the row should
									// separate from it by value alone.
									'hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:ring-ring flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none',
											// The active row is marked, not filled. A solid accent
											// block here fights the matte surface it sits on.
											isActive && 'text-primary font-medium'
										)}
									>
										<span className="truncate">
											{camera.name || 'Unnamed Camera'}
										</span>
										{isActive ? (
											<Check className="ml-auto h-3.5 w-3.5 shrink-0" />
										) : null}
									</button>
								)
							})}
						</div>
					</PopoverContent>
				</Popover>
			) : (
				<div className="flex h-8 min-w-40 items-center justify-center gap-2 px-3 text-xs font-medium">
					{label}
				</div>
			)}

			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 shrink-0 rounded-xl"
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
