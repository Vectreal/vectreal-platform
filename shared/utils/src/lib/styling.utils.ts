import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The stacking tiers declared as `--z-index-*` in `globals.css`.
 *
 * tailwind-merge validates the z-index group as `z-<number>`, so a tier name is
 * invisible to it: `cn('z-overlay', 'z-above-nav')` kept both classes and left
 * the winner to whichever rule sorted last in the stylesheet. That order is
 * alphabetical, so a caller passing `z-above-nav` to a component defaulting to
 * `z-overlay` was silently overridden by the default - the exact failure `cn()`
 * exists to prevent, on the one scale where losing is invisible until something
 * paints in the wrong layer.
 *
 * `z-index-tiers.spec.ts` pins this list against the stylesheet, because the
 * names living in two files is the obvious way for it to rot.
 */
const Z_INDEX_TIERS = [
	'page-chrome',
	'nav',
	'overlay',
	'above-nav',
	'tooltip',
	'overlay-raised',
	'select'
]

const twMerge = extendTailwindMerge({
	extend: { classGroups: { z: [{ z: Z_INDEX_TIERS }] } }
})

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export { Z_INDEX_TIERS }
