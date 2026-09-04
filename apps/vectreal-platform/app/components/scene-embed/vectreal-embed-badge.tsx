import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'

/**
 * The Vectreal mark on an embedded scene, shown on plans that have not bought
 * `embed_branding_removal`.
 *
 * Lives in the app, not in `@vctrl/viewer`. The viewer package is AGPL and is
 * meant to be usable by anyone; a Vectreal link compiled into it is our
 * branding riding along in someone else's build. The viewer offers an overlay
 * slot, and this is the platform putting its own mark into it.
 *
 * Independent of the author's info-popover setting on purpose. Those are
 * different questions - what the author wants to say about their scene, and
 * whose plan this scene is published under - and folding the mark into the
 * popover made switching the popover off a free way to remove the branding.
 *
 * Styled from the viewer's own `--vctrl-*` tokens rather than the app's,
 * because it renders inside the `.viewer` container and has to resolve to the
 * scheme the viewer resolved. App tokens follow the `dark` class on `<html>`,
 * which an embedded viewer following `prefers-color-scheme` need not agree
 * with.
 *
 * Top-right: the info popover holds the bottom-left of the same container and
 * the playback controls hold the bottom-right.
 *
 * Full opacity, like that chrome, rather than the faded mark this started as.
 * `--vctrl-text` on `--vctrl-bg` is 6.1:1, but at 70% the whole element
 * composites toward the scene behind it and the label fell to 3.7:1 - under
 * AA for 11px text, on the one element in the viewer a reader is least able to
 * enlarge. Hover moves the background, the way the other chrome does.
 */
export const VectrealEmbedBadge = () => (
	<a
		className="vctrl-embed-badge absolute top-0 right-0 m-2 flex items-center gap-1.5 rounded-full bg-[var(--vctrl-bg)] px-2.5 py-1 text-[0.6875rem] leading-none text-[var(--vctrl-text)] no-underline transition-[background-color] duration-300 visited:text-[var(--vctrl-text)] hover:bg-[var(--vctrl-hover-bg)] hover:text-[var(--vctrl-text)] active:bg-[var(--vctrl-active-bg)] [&_svg]:h-3 [&_svg]:w-3 [&_svg]:text-current"
		href="https://vectreal.com"
		target="_blank"
		rel="noopener noreferrer"
	>
		<VectrealLogoSmall className="text-current" />
		Vectreal
	</a>
)

export default VectrealEmbedBadge
