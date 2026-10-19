import { type MetaFunction, Outlet } from 'react-router'

import { SheetFrame } from '../../components/layout-components'
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
		<SheetFrame>
			<div className={styles.root}>
				<Outlet />
			</div>
		</SheetFrame>
	)
}
