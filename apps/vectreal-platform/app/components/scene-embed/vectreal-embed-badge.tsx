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
 * Drawn like the viewer's own controls: a `shell-panel` from the shared theme
 * stylesheet, with muted text that brightens on hover. It renders inside the
 * viewer, so the palette is the scheme the viewer carries, not the `dark` class
 * on `<html>`, which an embed following `prefers-color-scheme` need not match.
 *
 * Top-right: the info popover holds the bottom-left of the same container and
 * the playback controls hold the bottom-right.
 *
 * The color sits on the panel and the link inherits it: the viewer container's
 * `[&_a]:text-inherit` outranks a color class on the anchor itself. Full
 * opacity, never the faded mark this started as: at 70% the 11px label
 * measured 3.7:1, under AA on the one element a reader cannot enlarge.
 * `contrast-tokens.spec.ts` holds muted text on the panel to AA.
 */
export const VectrealEmbedBadge = () => (
	<div className="vctrl-embed-badge shell-panel text-muted-foreground absolute top-0 right-0 m-2">
		<a
			className="shell-focus hover:text-foreground hover:bg-foreground/5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] leading-none no-underline transition-colors duration-150 motion-reduce:transition-none [&_svg]:h-3 [&_svg]:w-3"
			href="https://vectreal.com"
			target="_blank"
			rel="noopener noreferrer"
		>
			<VectrealLogoSmall className="text-current" />
			Vectreal
		</a>
	</div>
)

export default VectrealEmbedBadge
