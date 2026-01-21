import { cn } from '@shared/utils'
import { type MetaFunction, Outlet } from 'react-router'

import { buildMeta, getRootMeta } from '../../lib/seo'

import type { RootLoader } from '../../root'

import styles from '../../styles/mdx.module.css'

export const meta: MetaFunction<undefined, { root: RootLoader }> = (
	rootLoaderData
) => buildMeta([], getRootMeta(rootLoaderData), { private: false })

export default function MdxLayout() {
	return (
		<div className={cn(styles.root, 'px-4 py-16')}>
			<Outlet />
		</div>
	)
}
