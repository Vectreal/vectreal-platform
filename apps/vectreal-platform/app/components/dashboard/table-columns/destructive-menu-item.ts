/**
 * Destructive dropdown item styling.
 *
 * Previously `text-destructive-foreground` (near-white) on a transparent
 * background, which is unreadable in light mode. `text-destructive` is the
 * token meant for destructive text; the tint only appears on focus.
 */
export const DESTRUCTIVE_MENU_ITEM =
	'text-destructive focus:bg-destructive/10 focus:text-destructive'
