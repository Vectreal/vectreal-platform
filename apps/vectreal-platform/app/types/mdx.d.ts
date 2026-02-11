declare module '*.mdx' {
	import type { ReactElement } from 'react'

	const MDXComponent: (props: Record<string, unknown>) => ReactElement | null
	export default MDXComponent
}
