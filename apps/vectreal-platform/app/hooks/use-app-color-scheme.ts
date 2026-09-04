import { useEffect, useState } from 'react'

/**
 * The color scheme the app is actually painting in, for surfaces that embed
 * the viewer inside our own chrome.
 *
 * Read off `<html class="dark">` rather than the `theming` cookie, because the
 * class is where every input has already been resolved: the cookie's
 * `light | dark | system`, the OS preference behind `system`, and the
 * force-dark routes in `isForceDarkRoute`. Sampling the cookie would reproduce
 * two of those three and get the third wrong.
 *
 * Observed rather than sampled once, so flipping the theme toggle moves the
 * viewer with the page around it instead of leaving it on the scheme it
 * mounted in.
 *
 * `'dark'` before the first client read. Nothing themed is committed from that
 * seed: `ClientVectrealViewer` renders its `fallback` during SSR and until the
 * viewer module resolves, and the fallback ignores `theme` entirely. The value
 * first reaches anything that reads it after the effect has run.
 */
export function useAppColorScheme(): 'light' | 'dark' {
	const [scheme, setScheme] = useState<'light' | 'dark'>('dark')

	useEffect(() => {
		const root = document.documentElement
		const read = () => {
			setScheme(root.classList.contains('dark') ? 'dark' : 'light')
		}

		read()

		const observer = new MutationObserver(read)
		observer.observe(root, { attributeFilter: ['class'] })

		return () => observer.disconnect()
	}, [])

	return scheme
}
