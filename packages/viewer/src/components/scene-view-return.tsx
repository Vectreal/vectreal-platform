import { cn } from '@shared/utils'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import ChevronLeftIcon from './assets/chevron-left-icon'
import { FOCUS_RING } from './focus-ring'

interface SceneViewReturnProps {
	/** The hotspot the view is standing at, or null when it is not at one. */
	hotspotName: null | string
	onReturn: () => void
	/**
	 * Where focus goes when the button leaves while holding it. The button
	 * unmounts the moment it has done its job, and focus left on a removed node
	 * falls to `<body>`, which drops a keyboard visitor out of the viewer.
	 */
	focusOnLeave: HTMLElement | null
}

const classes = {
	root: 'vctrl-viewer-scene-view-return absolute top-0 left-1/2 z-[100] m-2 -translate-x-1/2',
	button:
		'flex h-8 cursor-pointer appearance-none items-center gap-1 rounded-full border-0 bg-[var(--vctrl-bg)] py-0 pr-3.5 pl-2.5 text-xs leading-none font-medium whitespace-nowrap text-[var(--vctrl-text)] transition-colors duration-200 hover:bg-[var(--vctrl-hover-bg)] active:bg-[var(--vctrl-active-bg)]',
	icon: 'h-3.5 w-3.5'
} as const

const ReturnButton = ({
	onReturn,
	focusOnLeave
}: Omit<SceneViewReturnProps, 'hotspotName'>) => {
	const buttonRef = useRef<HTMLButtonElement>(null)
	const focusOnLeaveRef = useRef(focusOnLeave)
	focusOnLeaveRef.current = focusOnLeave

	// A layout cleanup, because it runs while the button is still in the
	// document: by the time a passive one runs, focus has already fallen.
	useLayoutEffect(() => {
		const button = buttonRef.current
		return () => {
			if (button && button.ownerDocument.activeElement === button) {
				focusOnLeaveRef.current?.focus({ preventScroll: true })
			}
		}
	}, [])

	return (
		<div className={classes.root}>
			<button
				ref={buttonRef}
				type="button"
				className={cn(classes.button, FOCUS_RING)}
				onClick={onReturn}
			>
				<ChevronLeftIcon className={classes.icon} />
				Back to scene view
			</button>
		</div>
	)
}

/**
 * The way back from a hotspot's camera.
 *
 * Drawn only while the view stands at a hotspot, where it is the one control
 * that leads anywhere else. Top centre because every corner and the bottom
 * edge already belong to something on one surface or another.
 *
 * The announcement lives outside the button so it outlives it: leaving is the
 * moment the button disappears, and also the moment worth telling a screen
 * reader about.
 */
const SceneViewReturn = ({
	hotspotName,
	onReturn,
	focusOnLeave
}: SceneViewReturnProps) => {
	const [announcement, setAnnouncement] = useState('')
	const previousName = useRef(hotspotName)

	useEffect(() => {
		if (hotspotName) {
			setAnnouncement(`Viewing ${hotspotName}`)
		} else if (previousName.current) {
			setAnnouncement('Back to scene view')
		}
		previousName.current = hotspotName
	}, [hotspotName])

	return (
		<>
			<div className="sr-only" role="status" aria-live="polite">
				{announcement}
			</div>
			{hotspotName !== null && (
				<ReturnButton onReturn={onReturn} focusOnLeave={focusOnLeave} />
			)}
		</>
	)
}

export default SceneViewReturn
