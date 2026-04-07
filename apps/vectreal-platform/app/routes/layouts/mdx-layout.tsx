import { cn } from '@shared/utils'
import { type MetaFunction, Outlet } from 'react-router'

import { buildMeta, buildPageMeta, getRootMeta } from '../../lib/seo'
import { getLegalPageSeo } from '../../lib/seo-registry'
import styles from '../../styles/mdx.module.css'

import type { RootLoader } from '../../root'

export const meta: MetaFunction<undefined, { root: RootLoader }> = (args) =>
	(() => {
		const legalPageSeo = getLegalPageSeo(args.location.pathname)

		if (legalPageSeo) {
			return buildPageMeta(legalPageSeo, getRootMeta(args))
		}

		return buildMeta([], getRootMeta(args), {
			canonical: args.location.pathname
		})
	})()

export default function MdxLayout() {
	return (
		<div className={cn(styles.root, 'px-6 py-20 md:px-8')}>
			<Outlet />
		</div>
	)
}
