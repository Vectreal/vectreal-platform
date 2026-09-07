/**
 * How a plan limit is written for a reader.
 *
 * Extracted so `product-copy.ts` can render plan numbers rather than restate
 * them. It lived inside `pricing-cards-section.tsx`, which `product-copy.ts`
 * cannot import for two reasons: that component already takes nine names from
 * `product-copy.ts`, so importing back would close a cycle, and
 * `product-copy.ts` is read by `llms[.]txt.ts`, `seo.ts` and `seo-registry.ts`,
 * none of which render anything, so reaching into a `.tsx` module would pull
 * Radix and lucide into their graphs. The rule is not that a constants module
 * may not import a component - `constants/dashboard.tsx` does - it is these two.
 *
 * Four user-facing strings came with it: "Custom", "Unlimited", and the " GB"
 * and " MB" suffixes. `product-copy.ts`'s own docblock says none of them belong
 * in a component.
 *
 * `key` stays a `string` rather than a `LimitKey`; every caller already passes
 * one, so narrowing would compile today, but it is a second change.
 *
 * `locale` is optional, and omitting it keeps `toLocaleString`'s default. The
 * plan cards omit it and render for whoever is looking, which does mean their
 * numbers can differ between the server render and the browser, which predates
 * this module and is not decided here. A caller writing a fixed English
 * sentence passes one, so the published bytes do not depend on the locale of
 * whichever machine happened to run the render.
 */

/**
 * The locale published English prose formats its numbers with.
 *
 * The pages that carry these numbers are rendered by a machine, not for a
 * reader with a locale: `/llms.txt` and `/pricing` per request in the
 * container, the docs and news pages during `docker build`. Neither declares a
 * `LANG`, so without this the published number would follow a container default
 * nobody chose. `buildWebSiteJsonLd` already declares `inLanguage: 'en-US'`.
 */
export const PUBLISHED_COPY_LOCALE = 'en-US'

export function formatLimitValue(
	key: string,
	v: number | null,
	locale?: string
): string {
	if (key === 'storage_bytes_total') {
		if (v === null) return 'Custom'
		const gb = v / (1024 * 1024 * 1024)
		if (gb >= 1) return `${gb.toLocaleString(locale)} GB`
		return `${(v / (1024 * 1024)).toLocaleString(locale)} MB`
	}
	if (key === 'storage_bytes_per_scene') {
		if (v === null) return 'Custom'
		return `${(v / (1024 * 1024)).toLocaleString(locale)} MB`
	}
	return v === null ? 'Unlimited' : v.toLocaleString(locale)
}

/**
 * The same value with the thing it counts, so a sentence can interpolate it.
 *
 * The plural is the whole reason this exists rather than `${n} scenes` at the
 * call site: Free's `projects_total` is 1 today, so a count of one is a config
 * edit away from publishing "1 scenes". `null` reads as unlimited and takes the
 * plural, which is what "Unlimited scenes" wants.
 */
export function formatLimitCount(
	key: string,
	v: number | null,
	noun: string,
	locale?: string
): string {
	return `${formatLimitValue(key, v, locale)} ${noun}${v === 1 ? '' : 's'}`
}
