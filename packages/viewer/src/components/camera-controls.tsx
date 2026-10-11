import { cn } from '@shared/utils'
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react'

import CheckIcon from './assets/check-icon'
import ChevronLeftIcon from './assets/chevron-left-icon'
import ChevronRightIcon from './assets/chevron-right-icon'
import { CHROME_BUTTON } from './chrome-classes'

export interface CameraControlsOption {
	cameraId: string
	name?: null | string
}

export interface CameraControlsProps {
	/** The scene cameras to step through, in order. */
	cameras: readonly CameraControlsOption[]
	/** The camera the view is on, as the viewer last reported it. */
	activeCameraId: null | string
	onSelect: (cameraId: string) => void
	/**
	 * What the view is called while it stands on a camera this list does not
	 * hold - a hotspot's, reached by clicking its marker. Without it the
	 * control would fall back to the first camera and claim that one was active.
	 */
	offListLabel?: null | string
	className?: string
}

/**
 * Below this, stepping through is faster than opening a list, so the name is
 * plain text and a list affordance would promise something pointless.
 */
const LIST_THRESHOLD = 3

const classes = {
	root: 'vctrl-viewer-camera-controls shell-panel text-foreground flex items-center gap-0.5 p-1',
	arrow: cn(
		CHROME_BUTTON,
		'flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 leading-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'
	),
	label:
		'flex h-7 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-xs leading-none font-medium sm:min-w-32',
	counter: 'text-muted-foreground text-[11px] tabular-nums',
	list: 'shell-panel absolute bottom-full left-1/2 mb-2 flex max-h-64 w-56 -translate-x-1/2 flex-col overflow-y-auto p-1',
	// Marked the way the shared menus mark an item, by tint rather than a ring:
	// a ring is clipped by the scrolling list and outweighs the rows around it.
	option:
		'text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground flex w-full cursor-pointer appearance-none items-center gap-2 rounded-[var(--radius,1rem)] border-0 bg-transparent px-3 py-2 text-left text-xs outline-hidden transition-colors duration-150 motion-reduce:transition-none',
	icon: 'h-3.5 w-3.5 shrink-0'
} as const

const cameraName = (camera: CameraControlsOption | null | undefined) =>
	camera?.name?.trim() || 'Unnamed camera'

/**
 * `‹ Camera name  2/5 ›`, the viewer's switcher between scene cameras.
 *
 * Presentational, like `AnimationControls`: the viewer draws it from its own
 * camera state, and a host drawing its own layout can render it from the
 * `camera_changed` events and `activate_camera` commands instead.
 *
 * The arrows carry the control and wrap at either end; the name is quiet text,
 * and the counter gives the orientation a dropdown only implies. Past three
 * cameras the name also opens a list.
 *
 * Bottom centre: the info popover holds bottom-left, the playback controls
 * bottom-right, and the way back from a hotspot top centre.
 */
const CameraControls = ({
	cameras,
	activeCameraId,
	onSelect,
	offListLabel,
	className
}: CameraControlsProps) => {
	// Falling back to the first camera keeps the control labelled before the
	// viewer has reported which camera it opened on.
	const activeIndex = useMemo(() => {
		if (!cameras.length) return -1
		const index = cameras.findIndex(
			(camera) => camera.cameraId === activeCameraId
		)
		return index >= 0 ? index : 0
	}, [cameras, activeCameraId])

	// A camera the viewer reported that is not in the list. Only a reported one:
	// before the first event the fallback above is the honest guess.
	const isOffList =
		activeCameraId !== null &&
		!cameras.some((camera) => camera.cameraId === activeCameraId)

	const cycle = useCallback(
		(direction: -1 | 1) => {
			if (!cameras.length) return

			// Off the list, each arrow steps onto it from its own end: next is the
			// first camera, previous the last.
			const nextIndex = isOffList
				? direction === 1
					? 0
					: cameras.length - 1
				: (activeIndex + direction + cameras.length) % cameras.length

			onSelect(cameras[nextIndex].cameraId)
		},
		[activeIndex, cameras, isOffList, onSelect]
	)

	// With one camera, the arrows still lead back onto it from off the list.
	const isCyclable = cameras.length > 1 || (isOffList && cameras.length > 0)
	const activeName = isOffList
		? offListLabel?.trim() || 'Hotspot view'
		: cameraName(cameras[activeIndex])

	const label = (
		<>
			{/* Announced on change so the camera is not a purely visual state. */}
			<span className="truncate" aria-live="polite">
				{activeName}
			</span>
			{isCyclable && !isOffList ? (
				<span className={classes.counter}>
					{activeIndex + 1}/{cameras.length}
				</span>
			) : null}
		</>
	)

	return (
		<div
			className={cn(classes.root, className)}
			role="group"
			aria-label="Cameras"
		>
			<button
				type="button"
				className={classes.arrow}
				onClick={() => cycle(-1)}
				disabled={!isCyclable}
				aria-label="Previous camera"
			>
				<ChevronLeftIcon className={classes.icon} />
			</button>

			{cameras.length > LIST_THRESHOLD ? (
				<CameraList
					cameras={cameras}
					activeIndex={isOffList ? -1 : activeIndex}
					activeName={activeName}
					onSelect={onSelect}
				>
					{label}
				</CameraList>
			) : (
				<div className={classes.label}>{label}</div>
			)}

			<button
				type="button"
				className={classes.arrow}
				onClick={() => cycle(1)}
				disabled={!isCyclable}
				aria-label="Next camera"
			>
				<ChevronRightIcon className={classes.icon} />
			</button>
		</div>
	)
}

/**
 * Keeps a press inside the list from moving focus.
 *
 * Safari and macOS Firefox do not focus a button on mousedown, and a press on
 * the list's padding or scrollbar focuses nothing in any browser, so either
 * would blur the list with no target and close it before the click landed.
 * Cancelling the mousedown's default leaves focus where the keyboard put it,
 * and the click still fires.
 */
const keepFocus = (event: React.MouseEvent) => event.preventDefault()

interface CameraListProps {
	cameras: readonly CameraControlsOption[]
	/** -1 while the view is off the list. */
	activeIndex: number
	activeName: string
	onSelect: (cameraId: string) => void
	children: React.ReactNode
}

/**
 * The name as a trigger for a list of every camera.
 *
 * Hand-rolled like `InfoPopover`: the viewer ships into pages it does not own,
 * and carries no popover library. Escape and a press outside close it, focus
 * goes back to the trigger, and the arrow keys move between options.
 */
const CameraList = ({
	cameras,
	activeIndex,
	activeName,
	onSelect,
	children
}: CameraListProps) => {
	const [isOpen, setIsOpen] = useState(false)
	const listId = useId()
	const rootRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

	const close = useCallback((returnFocus: boolean) => {
		setIsOpen(false)
		if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
	}, [])

	// Opening lands on the current camera, so the arrow keys start from it.
	// Only on opening: a camera change while the list is open (a host's
	// command, an interaction) must not pull focus off the visitor's place.
	const activeIndexRef = useRef(activeIndex)
	activeIndexRef.current = activeIndex
	useLayoutEffect(() => {
		if (!isOpen) return
		optionRefs.current[Math.max(activeIndexRef.current, 0)]?.focus({
			preventScroll: true
		})
	}, [isOpen])

	useEffect(() => {
		if (!isOpen) return

		// A press outside on something that takes no focus - the canvas, empty
		// page - would leave focus where it is, so it closes the list itself.
		const handlePointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) close(false)
		}
		document.addEventListener('pointerdown', handlePointerDown)
		return () => document.removeEventListener('pointerdown', handlePointerDown)
	}, [close, isOpen])

	// On the root rather than the listbox, so Escape also closes the list from
	// the trigger, where Shift+Tab out of the first option lands.
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (!isOpen) return

		if (event.key === 'Escape') {
			// The viewer's own Escape (leaving a hotspot view) skips an expanded
			// trigger and the listbox; claiming the key keeps a host's Escape
			// (the preview page leaves on one) from acting on it too.
			event.preventDefault()
			close(true)
			return
		}

		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
		event.preventDefault()
		const focused = optionRefs.current.indexOf(
			document.activeElement as HTMLButtonElement
		)
		const step = event.key === 'ArrowDown' ? 1 : -1
		// From the trigger, each arrow enters the list at its own end.
		const next =
			focused < 0
				? step === 1
					? 0
					: cameras.length - 1
				: (focused + step + cameras.length) % cameras.length
		optionRefs.current[next]?.focus({ preventScroll: true })
	}

	return (
		<div
			ref={rootRef}
			className="relative min-w-0"
			onKeyDown={handleKeyDown}
			/*
			  Focus leaving the control closes the list, whether it moved to
			  another element, to nothing, or out of the document (a click in the
			  page around an embed). Presses inside never move focus - see
			  `keepFocus` - so a blur here is always focus really leaving.
			*/
			onBlur={(event) => {
				if (!rootRef.current?.contains(event.relatedTarget)) setIsOpen(false)
			}}
		>
			<button
				ref={triggerRef}
				type="button"
				className={cn(CHROME_BUTTON, classes.label, 'text-foreground w-full')}
				onMouseDown={keepFocus}
				onClick={() => (isOpen ? close(true) : setIsOpen(true))}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={isOpen ? listId : undefined}
				aria-label={`Camera: ${activeName}. Choose a camera`}
			>
				{children}
			</button>

			{isOpen ? (
				<div
					id={listId}
					role="listbox"
					aria-label="Cameras"
					className={classes.list}
					onMouseDown={keepFocus}
				>
					{cameras.map((camera, index) => {
						const isActive = index === activeIndex
						return (
							<button
								key={camera.cameraId}
								ref={(node) => {
									optionRefs.current[index] = node
								}}
								type="button"
								role="option"
								aria-selected={isActive}
								className={cn(
									classes.option,
									// Marked by its check, not filled: a solid row fights the surface.
									isActive && 'text-foreground'
								)}
								onClick={() => {
									onSelect(camera.cameraId)
									close(true)
								}}
							>
								<span className="truncate">{cameraName(camera)}</span>
								{isActive ? (
									<CheckIcon className={cn(classes.icon, 'ml-auto')} />
								) : null}
							</button>
						)
					})}
				</div>
			) : null}
		</div>
	)
}

export default CameraControls
