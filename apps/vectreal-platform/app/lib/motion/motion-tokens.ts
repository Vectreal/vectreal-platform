/**
 * The motion scale from `globals.css`, in the units Framer Motion wants.
 *
 * The CSS custom properties are milliseconds and are only usable inside a CSS
 * rule; Framer takes seconds as a plain number, so it cannot read them. Every
 * animated component therefore re-typed the numbers, and they drifted: the auth
 * screens alone carried 0.2, 0.22, 0.25, 0.35 and 0.4 second transitions, only
 * two of which corresponded to a rung on the scale.
 *
 * Keep these in sync with the `--duration-*` and `--ease-*` blocks in
 * `shared/components/src/styles/globals.css`. They are the same scale expressed
 * twice because two runtimes need it, not a second source of truth.
 */

export const duration = {
	instant: 0.08,
	fast: 0.15,
	base: 0.25,
	slow: 0.4,
	cinematic: 0.7
} as const

/**
 * Gap between consecutive items in a staggered entrance.
 *
 * Not a `--duration-*` rung: this is the offset between two animations, not the
 * length of one, so the scale has no name for it. Kept here anyway so a form
 * does not pick its own.
 */
export const STAGGER_STEP = 0.05

/** Cubic-bezier control points, matching the `--ease-*` tokens. */
export const ease = {
	out: [0.16, 1, 0.3, 1],
	inOut: [0.4, 0, 0.2, 1],
	spring: [0.34, 1.56, 0.64, 1]
} as const satisfies Record<string, [number, number, number, number]>

/**
 * The entrance for an auth panel that animates in as a whole.
 *
 * Used by the confirmation gate and the forgot-password screen. Sign-in and
 * sign-up stagger their fields with `authFieldEntrance` instead, and
 * reset-password does not animate at all - so this is the shared shape for the
 * screens that need it, not a claim that all five behave alike.
 */
export const authPanelEntrance = {
	initial: { opacity: 0, y: 12 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: duration.slow, ease: ease.out }
} as const

/** Staggered field entrance, `index` being the field's position in the form. */
export function authFieldEntrance(index: number) {
	return {
		initial: { opacity: 0, y: 8 },
		animate: { opacity: 1, y: 0 },
		transition: {
			duration: duration.base,
			delay: index * STAGGER_STEP,
			ease: ease.out
		}
	}
}
