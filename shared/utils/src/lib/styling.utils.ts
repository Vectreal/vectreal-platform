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

/**
 * The width scale declared as `--container-*` in `globals.css`, for the same
 * reason and with the same failure mode as the tiers above.
 *
 * tailwind-merge validates the width groups as a number, a fraction or an
 * arbitrary value, so a container name is invisible to it: `cn('w-detail-panel',
 * 'w-[21rem]')` kept both classes, and which one applied was decided by the
 * order Tailwind happened to emit them in rather than by the caller. The
 * publisher's tool sidebar is exactly that call - a component defaulting to the
 * detail-panel width, overridden to 21rem by one consumer.
 *
 * Only names the app declares. Tailwind's own `--container-*` defaults
 * (`w-md`, `max-w-xl`) are already in the built-in groups.
 */
const CONTAINER_SCALE = ['detail-panel']

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			z: [{ z: Z_INDEX_TIERS }],
			w: [{ w: CONTAINER_SCALE }],
			'max-w': [{ 'max-w': CONTAINER_SCALE }],
			'min-w': [{ 'min-w': CONTAINER_SCALE }]
		}
	}
})

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export { CONTAINER_SCALE, Z_INDEX_TIERS }
