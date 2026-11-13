import { createContext } from 'react'

/** The languages the viewer's own words come in. */
export type ViewerLanguage = 'en' | 'de'

/**
 * The language of the viewer's own words: the scene's locale when it names
 * one, else the visitor's browser. German for any `de`, English otherwise.
 */
export function resolveViewerLanguage(
	locale: string | undefined
): ViewerLanguage {
	const tag =
		locale ?? (typeof navigator !== 'undefined' ? navigator.language : '')
	return tag.toLowerCase().startsWith('de') ? 'de' : 'en'
}

/**
 * The viewer's language, for chrome a host puts inside it, so its help speaks
 * the same language as the viewer's own buttons.
 */
export const ViewerLanguageContext = createContext<ViewerLanguage>('en')
