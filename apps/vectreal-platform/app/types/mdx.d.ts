declare module '*.mdx' {
	import type { ReactElement } from 'react'

	const MDXComponent: (props: Record<string, unknown>) => ReactElement | null
	export const frontmatter: Record<string, unknown>
	export default MDXComponent
}
