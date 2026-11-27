import { useEffect, useRef, type ReactNode } from 'react'

import { useSettledImage } from '../hooks/use-settled-image'
import { useThumbnailEdgeBands } from '../hooks/use-thumbnail-edge-bands'
import {
	useViewerColorScheme,
	type ViewerTheme
} from '../hooks/use-viewer-color-scheme'
import { formatMessage, type ViewerMessages } from '../locales/en'
import CubeIcon from './assets/cube-icon'
import { CHROME_BUTTON } from './chrome-classes'
import { cn, withHostClasses } from './class-names'
import { ViewerLoadProgress } from './load-progress'
import {
	ViewerMessagesContext,
	useResolvedViewerMessages
} from './viewer-messages'

/**
 * `idle` offers the scene, `loading` shows the loader where the button was,
 * and `failed` offers it again after a load that did not finish.
 */
export type ViewerPosterState = 'idle' | 'loading' | 'failed'

export interface ViewerPosterProps {
	/** The scene's still image, usually its saved thumbnail. Absent, the poster shows `background` alone. */
	thumbnail?: string
	/**
	 * What the scene shows, for the button's accessible name: "View {label}
	 * in 3D". Usually the viewer's own `label`.
	 */
	label?: string
	/** @default 'idle' */
	state?: ViewerPosterState
	/** Pressed in `idle` and `failed`: mount the viewer and load the scene. */
	onActivate: () => void
	/** Drawn in place of the button while `loading`. Defaults to the viewer's own loader. */
	loader?: ReactNode
	/** As the viewer's `locale`: the language of the button. */
	locale?: string
	/** As the viewer's `messages`. */
	messages?: Partial<ViewerMessages>
	/** As the viewer's `theme`. @default 'system' */
	theme?: ViewerTheme
	/** A CSS background behind the image, such as the scene's stage color. */
	background?: string
	className?: string
}

const classes = {
	root: 'viewer vctrl-viewer vv:relative vv:isolate vv:h-full vv:w-full vv:overflow-clip vv:text-base',
	layer: 'vv:absolute vv:inset-0 vv:h-full vv:w-full',
	center:
		'vv:absolute vv:top-1/2 vv:left-1/2 vv:max-w-[calc(100%-2rem)] vv:-translate-x-1/2 vv:-translate-y-1/2',
	panel: 'shell-panel vv:rounded-full vv:p-1',
	button: cn(
		CHROME_BUTTON,
		'vv:flex vv:items-center vv:gap-2 vv:rounded-full vv:px-4 vv:py-2 vv:text-sm vv:font-medium vv:text-foreground'
	)
} as const

/**
 * What a scene shows before a visitor asks for it: its still image and one
 * button. Nothing of the scene is mounted behind it, so nothing in it can be
 * clicked, focused or scrolled, and the page around it scrolls as usual.
 *
 * Its own entry, `@vctrl/viewer/poster`, which imports no three.js and no
 * viewer, so a page that shows only posters downloads neither. The host
 * mounts `VectrealViewer` when `onActivate` fires and keeps the poster on
 * top, in `loading`, until the viewer draws its own loader.
 *
 * The image is laid out as the viewer lays out its loading thumbnail
 * (contained, its bands filled with its own edges), so the loader that
 * replaces the poster lines up with it.
 */
export const ViewerPoster = ({
	thumbnail,
	label,
	state = 'idle',
	onActivate,
	loader,
	locale,
	messages: messageOverrides,
	theme = 'system',
	background,
	className
}: ViewerPosterProps) => {
	const messages = useResolvedViewerMessages(locale, messageOverrides)
	const colorScheme = useViewerColorScheme(theme)
	const bandsRef = useRef<HTMLCanvasElement>(null)
	const imageRef = useRef<HTMLImageElement>(null)
	useThumbnailEdgeBands(bandsRef, imageRef, Boolean(thumbnail), thumbnail ?? '')
	const image = useSettledImage(imageRef, thumbnail)
	const failed = state === 'failed'
	const rootRef = useRef<HTMLDivElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const previousState = useRef(state)
	// Set when the visitor pressed this poster's button, so only a load they
	// started here moves focus; a host driving the state never does.
	const pressedHere = useRef(false)

	/*
	  The pressed button leaves when loading starts, so focus would fall to
	  the page: it stays on the poster instead, and goes to the retry button
	  when that load fails while the poster still holds it.
	*/
	useEffect(() => {
		const previous = previousState.current
		previousState.current = state
		const root = rootRef.current
		if (!root || previous === state) return
		if (state === 'loading' && pressedHere.current) {
			root.focus({ preventScroll: true })
		} else if (
			state === 'failed' &&
			previous === 'loading' &&
			document.activeElement === root
		) {
			buttonRef.current?.focus({ preventScroll: true })
		}
		if (state !== 'loading') pressedHere.current = false
	}, [state])

	return (
		<ViewerMessagesContext.Provider value={messages}>
			<div
				ref={rootRef}
				// Focusable by script only, to hold focus while the button is away.
				tabIndex={-1}
				className={withHostClasses(
					cn(classes.root, 'vv:outline-none', colorScheme),
					className
				)}
				style={background ? { background } : undefined}
			>
				{thumbnail && image.status !== 'failed' && (
					<>
						<canvas ref={bandsRef} aria-hidden className={classes.layer} />
						<img
							ref={imageRef}
							src={thumbnail}
							/*
							  Decorative: the button and the host's frame title name the
							  scene. Shown while it loads, unlike the loading thumbnail,
							  so a server-rendered poster paints before hydration; with
							  no alt text there is nothing for a browser to draw in its
							  place, and one that fails is removed.
							*/
							alt=""
							className={cn(classes.layer, 'vv:object-contain')}
							onLoad={image.onLoad}
							onError={image.onError}
						/>
					</>
				)}
				{/*
				  Mounted from the start, so a screen reader already knows the
				  region when loading or a failure is written into it. The
				  loader announces nothing itself: in the viewer the overlay
				  around it is the status region.
				*/}
				<span aria-live="polite" className="vv:sr-only">
					{state === 'loading'
						? messages.loading
						: failed
							? messages.posterLoadFailed
							: ''}
				</span>
				<div className={classes.center}>
					{state === 'loading' ? (
						(loader ?? <ViewerLoadProgress progress={null} />)
					) : (
						<div className={classes.panel}>
							<button
								ref={buttonRef}
								type="button"
								className={classes.button}
								onClick={() => {
									pressedHere.current = true
									onActivate()
								}}
								aria-label={
									!failed && label
										? formatMessage(messages.viewInThreeDLabel, { name: label })
										: undefined
								}
							>
								{!failed && <CubeIcon className="vv:size-4 vv:shrink-0" />}
								{failed ? messages.posterLoadFailed : messages.viewInThreeD}
							</button>
						</div>
					)}
				</div>
			</div>
		</ViewerMessagesContext.Provider>
	)
}
