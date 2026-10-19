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
 * (`rounded-[var(--radius,1rem)]` is the app's `rounded-lg`): the published
 * bundle clears the named radius scale, so `rounded-lg` there draws square.
 *
 * `[font-family:inherit]` because a browser gives a button a face of its own
 * wherever the host has no reset, and the viewer's text takes the host's.
 * On each control rather than on every button under the root, which would
 * also override a font a host set on a button of its own inside the viewer.
 */
export const CHROME_BUTTON =
	'shell-focus cursor-pointer [font-family:inherit] appearance-none border-0 bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-foreground/5 hover:text-foreground active:bg-foreground/10 motion-reduce:transition-none'

/**
 * Where the viewer puts the exported controls it draws itself. The components
 * carry no placement, so a host drawing its own can put them anywhere. Playback
 * takes the bottom-right, clear of the info popover's bottom-left; the camera
 * switcher the bottom center, narrow enough to leave both corners free.
 */
export const CHROME_PLACEMENT = {
	animationControls: 'absolute right-0 bottom-0 z-[100] m-2',
	cameraControls:
		'absolute bottom-0 left-1/2 z-[100] mb-2 max-w-[calc(100%-10rem)] -translate-x-1/2'
} as const
