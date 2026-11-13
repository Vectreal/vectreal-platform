/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * The languages the viewer's own words come in, by their language subtag.
 * English is the default and the source of truth for every message.
 *
 * Adding one here makes typecheck ask for its catalog in `@vctrl/viewer`
 * (`src/locales/<code>.ts` and its loader), so the list and the catalogs
 * cannot drift apart.
 */
export const VIEWER_LOCALES = ['en', 'de'] as const

/** A language the viewer has a catalog for. */
export type ViewerLocale = (typeof VIEWER_LOCALES)[number]

/** `tag` in its canonical BCP 47 form, or undefined when it is not one. */
function canonicalTag(tag: unknown): string | undefined {
	if (typeof tag !== 'string' || !tag.trim()) return undefined
	try {
		return Intl.getCanonicalLocales(tag.trim())[0]
	} catch {
		return undefined
	}
}

/**
 * The viewer language a BCP 47 tag asks for, by its language subtag: `de-AT`
 * asks for `de`. Undefined for anything that is not a tag, or a language the
 * viewer has no catalog for.
 */
export function matchViewerLocale(tag: unknown): ViewerLocale | undefined {
	const language = canonicalTag(tag)?.split('-')[0]
	return VIEWER_LOCALES.find((locale) => locale === language)
}

/**
 * A scene's `presentation.locale` as stored: the canonical tag when the viewer
 * has its language, else undefined. `en` and `de`, which every scene saved
 * before tags were accepted holds, pass unchanged.
 */
export function normalizeSceneLocale(tag: unknown): string | undefined {
	const canonical = canonicalTag(tag)
	return matchViewerLocale(canonical) ? canonical : undefined
}
