/**
 * The viewer's built-in controls, drawn the way the Publisher draws its own.
 *
 * The surface is `shell-panel` and focus is `shell-focus`, both from the
 * shared theme stylesheet (`shared/components/src/styles/theme.css`), which
 * the published bundle compiles in and confines to the viewer. A control reads
 * the palette of the scheme its viewer carries (`useViewerColorScheme`), so it
 * matches the viewer it sits in rather than the page around it.
 *
 * A button rests muted and brightens over a faint foreground tint, as the
 * Publisher's tool bar does; pressing deepens the tint. Shape and size stay
 * with each control, and a corner is `rounded-full` or spelled out
 * (`rounded-[var(--radius,1rem)]` is the app's `rounded-lg`): the viewer's
 * stylesheet clears the named radius scale, so `rounded-lg` draws square.
 *
 * `[font-family:inherit]` because a browser gives a button a face of its own
 * wherever the host has no reset, and the viewer's text takes the host's.
 * On each control rather than on every button under the root, which would
 * also override a font a host set on a button of its own inside the viewer.
 */
export const CHROME_BUTTON =
	'shell-focus vv:cursor-pointer vv:[font-family:inherit] vv:appearance-none vv:border-0 vv:bg-transparent vv:text-muted-foreground vv:transition-colors vv:duration-150 vv:hover:bg-foreground/5 vv:hover:text-foreground vv:active:bg-foreground/10 vv:motion-reduce:transition-none'

/**
 * Where the viewer puts the exported controls it draws itself. The components
 * carry no placement, so a host drawing its own can put them anywhere. Playback
 * takes the bottom-right, clear of the info popover's bottom-left; the camera
 * switcher the bottom center, narrow enough to leave both corners free.
 */
export const CHROME_PLACEMENT = {
	animationControls: 'vv:absolute vv:right-0 vv:bottom-0 vv:z-[100] vv:m-2',
	cameraControls:
		'vv:absolute vv:bottom-0 vv:left-1/2 vv:z-[100] vv:mb-2 vv:max-w-[calc(100%-10rem)] vv:-translate-x-1/2'
} as const
