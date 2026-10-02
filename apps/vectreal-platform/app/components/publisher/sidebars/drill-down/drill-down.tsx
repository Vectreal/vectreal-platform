import { cn } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
	Children,
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type KeyboardEvent,
	type ReactElement,
	type ReactNode
} from 'react'

import { PanelRowButton } from '../panel-row-button'
import { PanelCaption } from '../sidebar-section'

/**
 * Drill-down navigation for publisher sidebars.
 *
 * A sidebar is a stack of views. The root lists the tool's few most-used
 * controls and a trigger for each group; a trigger replaces the panel's content
 * with that group's view, and a back row returns. This replaces accordions,
 * which nested an elevated surface inside every open section and spent the
 * panel's width on it.
 *
 * The component is controlled: `path` is the stack of view ids below the root,
 * so a caller can derive it from state the canvas also writes (the hotspot tool
 * does, from `activeHotspotIdAtom`) rather than mirroring it.
 */

const ROOT_VIEW_ID = 'root'

/** `--ease-out` and `--duration-base`, which Framer cannot read as tokens. */
const SLIDE_TRANSITION = {
	duration: 0.25,
	ease: [0.16, 1, 0.3, 1] as const
}

type FocusIntent =
	| null
	| { kind: 'heading' }
	| { kind: 'trigger'; triggerKey: string }
	| { kind: 'view' }

const PATH_SEPARATOR = '\u001f'

function commonPrefixLength(a: string[], b: string[]): number {
	let length = 0
	while (length < a.length && length < b.length && a[length] === b[length]) {
		length++
	}
	return length
}

interface DrillDownContextValue {
	push: (viewId: string, triggerKey?: string) => void
	pop: () => void
	takeFocusIntent: () => FocusIntent
}

const DrillDownContext = createContext<DrillDownContextValue | null>(null)

/** Where a view sits in the stack, which decides its back row. */
interface DrillDownPosition {
	depth: number
	parentTitle: string
}

/*
  Kept apart from the navigation context and provided inside each view's
  animated wrapper, so a view keeps the position it was opened at. The view
  leaving still renders while the next one waits for it, and read from the
  live path it would grow a back row on its way out of the root (or lose it on
  its way back), shifting the panel before the slide.
*/
const DrillDownPositionContext = createContext<DrillDownPosition>({
	depth: 0,
	parentTitle: ''
})

function useDrillDown(): DrillDownContextValue {
	const context = useContext(DrillDownContext)
	if (!context) {
		throw new Error('Drill-down parts must be rendered inside <DrillDown>.')
	}
	return context
}

interface DrillDownViewProps {
	id: string
	/** Heading of a nested view. The root's heading is the sidebar's own. */
	title?: string
	/** One short sentence explaining the group, under the heading. */
	caption?: ReactNode
	children: ReactNode
	className?: string
}

interface DrillDownProps {
	path: string[]
	onPathChange: (path: string[]) => void
	/** What "back" returns to from the first level, for the back button's name. */
	rootTitle: string
	children: ReactNode
	className?: string
}

/**
 * Whether Escape belongs to the element that received it. Fields use Escape
 * to revert an edit (the camera name, the slider's exact entry), so a press
 * there must not also leave the view.
 */
function isEditableTarget(target: EventTarget): boolean {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.isContentEditable ||
		['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
		target.getAttribute('role') === 'combobox'
	)
}

function DrillDown({
	path,
	onPathChange,
	rootTitle,
	children,
	className
}: DrillDownProps) {
	const prefersReducedMotion = useReducedMotion()
	const activeId = path.at(-1) ?? ROOT_VIEW_ID

	const views = useMemo(
		() =>
			Children.toArray(children).filter(
				(child): child is ReactElement<DrillDownViewProps> =>
					isValidElement<DrillDownViewProps>(child) &&
					typeof child.props.id === 'string'
			),
		[children]
	)
	const titleOf = useCallback(
		(viewId: string | undefined) =>
			viewId === undefined || viewId === ROOT_VIEW_ID
				? rootTitle
				: (views.find((view) => view.props.id === viewId)?.props.title ??
					rootTitle),
		[views, rootTitle]
	)
	const activeView =
		views.find((view) => view.props.id === activeId) ??
		views.find((view) => view.props.id === ROOT_VIEW_ID)

	// Which way the last navigation went, for the slide.
	const previousDepthRef = useRef(path.length)
	const direction = path.length >= previousDepthRef.current ? 1 : -1
	useEffect(() => {
		previousDepthRef.current = path.length
	}, [path.length])

	/*
	  Where focus goes once the next view is on screen. It cannot be done when
	  the path changes: the outgoing view has to finish leaving first, so the
	  heading or trigger to focus does not exist yet. The view takes the intent
	  when it mounts. Only push and pop set one, so a path the canvas changes
	  (a marker clicked in the scene) never pulls focus out of the viewer.
	*/
	const focusIntentRef = useRef<FocusIntent>(null)
	/*
	  Whether focus was in this panel when the path last changed, read in the
	  commit that changed it. The outgoing view is still mounted then (it has
	  to animate out), so a Delete or Add that removes its own button still
	  counts, and a marker clicked on the canvas does not, because the click
	  already moved focus out.
	*/
	const containerRef = useRef<HTMLDivElement>(null)
	const hadFocusAtPathChangeRef = useRef(false)
	const takeFocusIntent = useCallback((): FocusIntent => {
		const intent = focusIntentRef.current
		focusIntentRef.current = null
		if (intent) return intent
		const focusWasLost =
			hadFocusAtPathChangeRef.current &&
			(document.activeElement === null ||
				document.activeElement === document.body)
		return focusWasLost ? { kind: 'view' } : null
	}, [])

	// The trigger each level was opened from, so a pop can hand focus back to
	// that exact row even when several rows open the same view.
	const openedFromRef = useRef<string[]>([])
	const requestedPathKeyRef = useRef<null | string>(null)
	const previousPathRef = useRef(path)
	const pathKey = path.join(PATH_SEPARATOR)

	useLayoutEffect(() => {
		hadFocusAtPathChangeRef.current =
			containerRef.current?.contains(document.activeElement) ?? false
		const previous = previousPathRef.current
		previousPathRef.current = pathKey ? pathKey.split(PATH_SEPARATOR) : []
		if (requestedPathKeyRef.current === pathKey) return
		// Moved without a push or pop (the canvas selected a marker), so the rows
		// recorded for the levels it replaced did not open what is there now.
		openedFromRef.current = openedFromRef.current.slice(
			0,
			commonPrefixLength(previous, previousPathRef.current)
		)
	}, [pathKey])

	const navigate = useCallback(
		(next: string[]) => {
			requestedPathKeyRef.current = next.join(PATH_SEPARATOR)
			onPathChange(next)
		},
		[onPathChange]
	)

	const push = useCallback(
		(viewId: string, triggerKey: string = viewId) => {
			openedFromRef.current = [
				...openedFromRef.current.slice(0, path.length),
				triggerKey
			]
			focusIntentRef.current = { kind: 'heading' }
			navigate([...path, viewId])
		},
		[navigate, path]
	)
	const pop = useCallback(() => {
		const popped = path.at(-1)
		if (popped === undefined) return
		const triggerKey = openedFromRef.current[path.length - 1] ?? popped
		focusIntentRef.current = { kind: 'trigger', triggerKey }
		navigate(path.slice(0, -1))
	}, [navigate, path])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				path.length === 0 ||
				isEditableTarget(event.target)
			) {
				return
			}
			// Consumed, so the enclosing sidebar does not read it as "close".
			event.preventDefault()
			event.stopPropagation()
			pop()
		},
		[path.length, pop]
	)

	const contextValue = useMemo(
		() => ({
			push,
			pop,
			takeFocusIntent
		}),
		[push, pop, takeFocusIntent]
	)
	const position = useMemo(
		() => ({ depth: path.length, parentTitle: titleOf(path.at(-2)) }),
		[path, titleOf]
	)

	// Exit runs with the *new* direction, which only `custom` can hand to an
	// element that has already left the tree.
	const slide = prefersReducedMotion ? 0 : 24
	const variants = {
		enter: (towards: number) => ({ opacity: 0, x: slide * towards }),
		center: { opacity: 1, x: 0 },
		exit: (towards: number) => ({ opacity: 0, x: -slide * towards })
	}

	return (
		<DrillDownContext.Provider value={contextValue}>
			<div
				onKeyDown={handleKeyDown}
				ref={containerRef}
				className={cn('relative min-h-0', className)}
			>
				<AnimatePresence mode="wait" initial={false} custom={direction}>
					<motion.div
						key={activeId}
						custom={direction}
						variants={variants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={
							prefersReducedMotion ? { duration: 0 } : SLIDE_TRANSITION
						}
					>
						<DrillDownPositionContext.Provider value={position}>
							{activeView}
						</DrillDownPositionContext.Provider>
					</motion.div>
				</AnimatePresence>
			</div>
		</DrillDownContext.Provider>
	)
}

function DrillDownView({
	title,
	caption,
	children,
	className
}: DrillDownViewProps) {
	const { pop, takeFocusIntent } = useDrillDown()
	const { depth, parentTitle } = useContext(DrillDownPositionContext)
	const sectionRef = useRef<HTMLElement>(null)

	// A layout effect, so focus arrives in the commit that shows the view. A
	// passive one left a frame where the view was on screen and focus on the page.
	useLayoutEffect(() => {
		const intent = takeFocusIntent()
		const section = sectionRef.current
		if (!intent || !section) return
		const heading = section.querySelector<HTMLElement>(
			'[data-drill-down-heading]'
		)
		const trigger =
			intent.kind === 'trigger'
				? section.querySelector<HTMLElement>(
						`[data-drill-down-trigger="${CSS.escape(intent.triggerKey)}"]`
					)
				: null
		/*
		  The view itself when there is no better stop: a row renamed while its
		  view was open has a new key, and the root has no heading of its own.
		  Never the first control, which can be a tooltip trigger that opens on
		  focus without the reader having asked for it.
		*/
		;(trigger ?? heading ?? section).focus()
	}, [takeFocusIntent])

	return (
		<section
			ref={sectionRef}
			tabIndex={-1}
			className={cn('space-y-4 outline-none', className)}
		>
			{depth > 0 && (
				<div className="space-y-1">
					<button
						type="button"
						onClick={pop}
						aria-label={`Back to ${parentTitle}`}
						className="publisher-shell-focus text-muted-foreground hover:text-foreground -ml-1 flex max-w-full min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium transition-colors"
					>
						<ChevronLeft className="size-3.5 shrink-0" />
						<span className="truncate">{parentTitle}</span>
					</button>
					{title && (
						<h3
							data-drill-down-heading
							tabIndex={-1}
							className="text-foreground truncate text-base font-medium outline-none"
						>
							{title}
						</h3>
					)}
				</div>
			)}
			{caption && <PanelCaption>{caption}</PanelCaption>}
			{children}
		</section>
	)
}

interface DrillDownTriggerProps {
	/** The id of the view this opens. */
	to: string
	label: string
	icon?: ReactNode
	/** The group's current state in a word or two, such as "Studio" or "3". */
	summary?: ReactNode
	/**
	 * Tells this trigger apart from others that open the same view (one row per
	 * camera, all opening "camera"), so going back focuses the right one.
	 */
	focusKey?: string
	/** Runs before the view opens, to select what the view will edit. */
	onSelect?: () => void
	disabled?: boolean
	className?: string
}

function DrillDownTrigger({
	to,
	label,
	icon,
	summary,
	focusKey,
	onSelect,
	disabled,
	className
}: DrillDownTriggerProps) {
	const { push } = useDrillDown()
	const triggerKey = focusKey ?? to

	return (
		<PanelRowButton
			data-drill-down-trigger={triggerKey}
			disabled={disabled}
			onClick={() => {
				onSelect?.()
				push(to, triggerKey)
			}}
			label={label}
			icon={icon}
			summary={summary}
			trailingIcon={<ChevronRight aria-hidden />}
			className={className}
		/>
	)
}

/**
 * Navigation for a trigger that needs its own layout (a list row with a drag
 * handle and a delete button). It must carry
 * `data-drill-down-trigger={triggerKey}` so going back can focus it again.
 */
function useDrillDownNavigation(): Pick<DrillDownContextValue, 'push' | 'pop'> {
	const { push, pop } = useDrillDown()
	return { push, pop }
}

export { DrillDown, DrillDownTrigger, DrillDownView, useDrillDownNavigation }
