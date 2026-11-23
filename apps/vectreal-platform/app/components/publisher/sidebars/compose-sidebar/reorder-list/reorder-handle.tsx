import { Reorder, useDragControls } from 'framer-motion'
import { GripVertical } from 'lucide-react'

import type { DragControls } from 'framer-motion'
import type { ReactNode } from 'react'

export type ReorderMoveDelta = number | 'first' | 'last'

const MOVE_BY_KEY: Record<string, ReorderMoveDelta> = {
	ArrowUp: -1,
	ArrowDown: 1,
	Home: 'first',
	End: 'last'
}

/** The keys framer-motion's `Reorder.Item` grabs and moves a focused row with. */
const ROW_KEYS_FRAMER_HANDLES = new Set([
	' ',
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight'
])

/**
 * Marks a row key as handled, so framer's own row reorder (which skips an
 * event whose default is prevented) never sees it. Keys from inside the row,
 * the handle among them, are left alone.
 */
export function swallowRowReorderKey(event: {
	key: string
	target: EventTarget
	currentTarget: EventTarget
	preventDefault: () => void
}): void {
	if (
		event.target === event.currentTarget &&
		ROW_KEYS_FRAMER_HANDLES.has(event.key)
	) {
		event.preventDefault()
	}
}

interface ReorderHandleProps {
	/** The row's name; the handle is labelled "Reorder <name>". */
	name: string
	/** Id of the hint the panel renders once, which every handle points at. */
	hintId: string
	dragControls: DragControls
	onMove: (delta: ReorderMoveDelta) => void
}

/**
 * The one control a reorderable row moves by: a pointer drag starts here, and
 * the arrow keys, Home and End move the row while the handle has focus.
 *
 * Starting the drag from the handle alone, rather than anywhere on the row, is
 * what keeps the rest of the row clickable.
 */
export function ReorderHandle({
	name,
	hintId,
	dragControls,
	onMove
}: ReorderHandleProps) {
	return (
		<button
			type="button"
			aria-label={`Reorder ${name}`}
			aria-keyshortcuts="ArrowUp ArrowDown Home End"
			aria-describedby={hintId}
			onPointerDown={(event) => dragControls.start(event)}
			onKeyDown={(event) => {
				const move = MOVE_BY_KEY[event.key]
				if (move === undefined) return
				event.preventDefault()
				onMove(move)
			}}
			className="shell-focus text-muted-foreground hover:text-foreground ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing"
		>
			<GripVertical aria-hidden className="size-3.5" />
		</button>
	)
}

/** Holds a handle's place in a row that does not reorder, so labels line up. */
export function ReorderHandleSpacer() {
	return <span aria-hidden className="ml-1 size-6 shrink-0" />
}

/**
 * One draggable row of a `Reorder.Group`.
 *
 * `useDragControls` is a hook, so it cannot be called inside the `map` that
 * renders the list; one item owning one controller is what lets the drag start
 * from the handle alone. The row itself is a render prop so it can place the
 * handle wherever its layout puts it.
 */
export function ReorderItem({
	value,
	reduceMotion,
	onDragStart,
	onDragEnd,
	children
}: {
	value: string
	reduceMotion: boolean
	onDragStart: () => void
	onDragEnd: () => void
	children: (dragControls: DragControls) => ReactNode
}) {
	const dragControls = useDragControls()

	return (
		<Reorder.Item
			value={value}
			dragListener={false}
			dragControls={dragControls}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			/*
			  The handle is the one keyboard control for moving a row: it moves
			  with the arrows and announces where the row landed. framer-motion
			  14 also makes each row a tab stop with its own Space and arrow
			  moves, which would add a second tab stop per list and a second,
			  silent way to reorder. -1 keeps the row out of the tab order;
			  framer applies our tabIndex over its own.

			  A click can still focus the row, and framer's row keys would then
			  move the draft without saving or announcing it. framer skips a key
			  whose default is already prevented, and ours runs first, so the
			  row swallows the keys framer acts on when it is the target itself.
			  Keys from the handle and the row's controls pass through.
			*/
			tabIndex={-1}
			onKeyDown={swallowRowReorderKey}
			/*
			  `layout` stays on whatever the motion preference is, and the
			  preference is honored by the transition instead.

			  `undefined` was the bug: framer defaults the prop to `true`, so the
			  reduced-motion branch was asking for *more* animation than the other
			  one. `Reorder.Item` also registers with its group only from
			  `onLayoutMeasure`, so turning layout off here is not obviously safe
			  either - and there is no reason to, since the transition already
			  carries the preference.
			*/
			layout="position"
			transition={
				reduceMotion
					? { duration: 0 }
					: { type: 'spring', stiffness: 600, damping: 40 }
			}
			whileDrag={reduceMotion ? undefined : { scale: 1.02 }}
			className="relative rounded-xl"
		>
			{children(dragControls)}
		</Reorder.Item>
	)
}
