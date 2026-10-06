/**
 * Shared geometry and stacking order for the publisher shell.
 *
 * ## Stacking
 *
 * **Everything here must stay below the overlay tier.** Radix portals its
 * overlays (dialog, alert-dialog, sheet, drawer) to the document body at
 * `--z-index-overlay`, which is 50, and the publisher's surfaces are ordinary
 * in-page elements in the same root stacking context. Anything at or above 50
 * paints over confirmation modals and their backdrops, which is how the
 * sidebars, then sitting at 70, ended up covering them.
 *
 * These stay literal rather than joining the tier scale in `globals.css`: the
 * scale names layers the whole app shares, and this is one surface ordering its
 * own parts underneath all of them.
 *
 * Within the shell the order is bottom-up by how much a surface should
 * interrupt: the card sits under the tools it sits beside, sidebars cover the
 * canvas chrome they slide over, and the header covers the sidebars because its
 * location dropdown extends down across them.
 *
 * Class strings are literal so Tailwind's scanner still finds them.
 */
export const PUBLISHER_LAYER = {
	/** The bottom-right column of the stage: save progress over the publish card. */
	card: 'z-10',
	/** Preview-mode camera controls, bottom-center of the stage. */
	previewControls: 'z-20',
	/**
	 * The hold-to-compare label, in the same bottom-center slot: it only shows
	 * with the optimization drawer open, which preview mode never is.
	 */
	compareLabel: 'z-20',
	/** Tool bar, top-left of the stage. */
	toolBar: 'z-30',
	/** Sliding panels: publish sidebar, compose sidebar, optimization drawer. */
	sidebar: 'z-40',
	/** Header row. Above the sidebars so its location dropdown is never clipped. */
	header: 'z-45'
} as const

/**
 * Distance every floating surface keeps from the edge of the canvas stage.
 *
 * One value so the tool bar, the publish card, and the preview controls all
 * share a margin, and nothing sits a few pixels off from its neighbours.
 */
export const PUBLISHER_EDGE_INSET = 'm-3'

/**
 * The same inset expressed for consumers that take a length rather than a
 * class, so toasts line up with the surfaces they appear beside. Matches
 * Tailwind's spacing-3.
 */
export const PUBLISHER_EDGE_INSET_PX = 12

/**
 * Insets for a panel that opens on the left of the stage, under the tool bar,
 * so it keeps the same 12px (`PUBLISHER_EDGE_INSET`) from every neighbor:
 * the bar above, the stage's left and bottom edges. The top is the bar's own
 * inset (12px), plus its height (a 36px trigger inside 4px of padding and a
 * 1px border on each side, so 46px), plus the 12px gap: 70px.
 */
export const PUBLISHER_BELOW_TOOL_BAR = 'pt-17.5 pb-3 pl-3'
