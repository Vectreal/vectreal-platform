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
 * Moved verbatim. `key` stays a `string` rather than a `LimitKey`; every caller
 * already passes one, so narrowing would compile today, but it is a second
 * change.
 */

export function formatLimitValue(key: string, v: number | null): string {
	if (key === 'storage_bytes_total') {
		if (v === null) return 'Custom'
		const gb = v / (1024 * 1024 * 1024)
		if (gb >= 1) return `${gb.toLocaleString()} GB`
		return `${(v / (1024 * 1024)).toLocaleString()} MB`
	}
	if (key === 'storage_bytes_per_scene') {
		if (v === null) return 'Custom'
		return `${(v / (1024 * 1024)).toLocaleString()} MB`
	}
	return v === null ? 'Unlimited' : v.toLocaleString()
}
