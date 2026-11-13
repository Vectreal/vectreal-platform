import { matchViewerLocale, type ViewerLocale } from '@vctrl/core'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { en, type ViewerMessages } from '../locales/en'

/**
 * Each language but English, loaded the first time a viewer needs it, so a
 * page only downloads the one it shows. Keyed by `VIEWER_LOCALES`: a language
 * added there without a catalog here fails typecheck.
 */
const CATALOGS: Record<
	Exclude<ViewerLocale, 'en'>,
	() => Promise<ViewerMessages>
> = {
	de: () => import('../locales/de').then((module) => module.de)
}

/**
 * The words of the viewer around it, for its chrome and for chrome a host
 * puts inside it, so a popover's How to move speaks the viewer's language.
 * English outside a viewer.
 */
export const ViewerMessagesContext = createContext<ViewerMessages>(en)

export const useViewerMessages = () => useContext(ViewerMessagesContext)

/** Catalogs already loaded, so every later viewer has them at once. */
const loadedCatalogs = new Map<ViewerLocale, ViewerMessages>([['en', en]])

/**
 * The words a viewer shows: the catalog for `locale` (the visitor's browser
 * language when absent), English for a language with none and while one
 * loads, and `overrides` on top of either.
 */
export function useResolvedViewerMessages(
	locale: string | undefined,
	overrides: Partial<ViewerMessages> | undefined
): ViewerMessages {
	const language =
		matchViewerLocale(
			locale ?? (typeof navigator !== 'undefined' ? navigator.language : '')
		) ?? 'en'
	const [, setLoadedCount] = useState(loadedCatalogs.size)

	useEffect(() => {
		if (language === 'en' || loadedCatalogs.has(language)) return
		let active = true
		CATALOGS[language]()
			.then((messages) => {
				loadedCatalogs.set(language, messages)
				if (active) setLoadedCount(loadedCatalogs.size)
			})
			// A catalog that fails to load leaves the viewer in English.
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [language])

	const catalog = loadedCatalogs.get(language) ?? en
	// By content, so a host passing a fresh object each render re-renders nothing.
	const overridesKey = overrides ? JSON.stringify(overrides) : ''
	return useMemo(
		() =>
			overridesKey
				? {
						...catalog,
						...(JSON.parse(overridesKey) as Partial<ViewerMessages>)
					}
				: catalog,
		[catalog, overridesKey]
	)
}
