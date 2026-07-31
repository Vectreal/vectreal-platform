/**
 * Shared geometry and stacking order for the publisher shell.
 *
 * ## Stacking
 *
 * **Everything here must stay below `z-50`.** Radix portals its overlays
 * (dialog, alert-dialog, sheet, drawer) to the document body at `z-50`, and the
 * publisher's surfaces are ordinary in-page elements in the same root stacking
 * context. Anything at or above 50 paints over confirmation modals and their
 * backdrops, which is how the sidebars at `z-[70]` ended up covering them.
 *
 * Within the shell the order is bottom-up by how much a surface should
 * interrupt: the card sits under the tools it sits beside, sidebars cover the
 * canvas chrome they slide over, and the header covers the sidebars because its
 * location dropdown extends down across them.
 *
 * Class strings are literal so Tailwind's scanner still finds them.
 */
export const PUBLISHER_LAYER = {
	/** Publish card, bottom-right of the canvas stage. */
	card: 'z-10',
	/** Preview-mode camera controls, bottom-center of the stage. */
	previewControls: 'z-20',
	/** Compose tool rail, top-left of the stage. */
	toolRail: 'z-30',
	/** Sliding panels: publish sidebar, compose sidebar, optimization drawer. */
	sidebar: 'z-40',
	/** Header row. Above the sidebars so its location dropdown is never clipped. */
	header: 'z-[45]'
} as const

/**
 * Distance every floating surface keeps from the edge of the canvas stage.
 *
 * One value so the tool rail, the publish card, and the preview controls all
 * share a margin, and nothing sits a few pixels off from its neighbours.
 */
export const PUBLISHER_EDGE_INSET = 'm-3'

/**
 * The same inset expressed for consumers that take a length rather than a
 * class, so toasts line up with the surfaces they appear beside. Matches
 * Tailwind's spacing-3.
 */
export const PUBLISHER_EDGE_INSET_PX = 12
