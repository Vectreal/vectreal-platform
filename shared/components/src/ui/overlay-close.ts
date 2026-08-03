/**
 * The close affordance shared by dialog, sheet and drawer.
 *
 * These had drifted into three different controls for one gesture. The dialog
 * used shadcn's default - a bare 16px icon on a `rounded-xs` corner, so the hit
 * target *was* the glyph and the shape matched nothing else in the system. The
 * sheet had already been corrected to a round 36px target. The drawer had no
 * built-in close at all, so six consumers each hand-rolled a
 * `<DrawerClose asChild><Button variant="ghost" size="icon">`, which is a third
 * size and shape again.
 *
 * One string, three primitives. A 36px round target clears the 24px minimum for
 * a pointer target with room to spare, and it grows a surface on hover rather
 * than only shifting opacity, so the affordance is visible before it is hit.
 *
 * `focus-visible` rather than `focus`: a mouse click on the close should not
 * leave a ring behind on the element that is about to unmount.
 */
/**
 * Shape, size and states, with no positioning.
 *
 * Split out because not every close is pinned to a corner - the publisher's
 * desktop sidebar lays its own out in a flex header, and was hand-rolling a
 * ghost icon button to do it. Same control, different placement.
 */
export const OVERLAY_CLOSE_APPEARANCE =
	'ring-offset-background focus-visible:ring-ring hover:bg-foreground/8 flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] hover:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none'

/** The appearance, pinned to the corner the overlay primitives use. */
export const OVERLAY_CLOSE_CLASSNAME = `absolute top-4 right-4 ${OVERLAY_CLOSE_APPEARANCE}`
