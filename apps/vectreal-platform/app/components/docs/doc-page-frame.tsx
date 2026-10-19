import { cn } from '@shared/utils'

import styles from './doc-page-frame.module.css'
import mdxStyles from '../../styles/mdx.module.css'
import { DraftingBackdrop } from '../layout-components/drafting-backdrop'

import type { ReactNode } from 'react'

/*
  A docs page arrives split in two by `remarkDocPageActions`: its introduction
  in `DocPageHead`, everything after it in `DocPageBody`. The docs layout sets
  both as items of one grid, so the head can run across every column while the
  body sits between the sidebars.
*/

/** The page's `#` title and introduction, edge to edge above the docs frame, on the floor every marketing head stands on. */
export const DocPageHead = ({ children }: { children?: ReactNode }) => (
	<header className={styles.head}>
		{/* The floor's host is its parent, which it reads for the text to keep clear of, so the text sits in the same layer. */}
		<div className={styles.bleed}>
			<DraftingBackdrop focusX={0.66} horizon={0.4} />
			<div data-keep-clear className={cn(mdxStyles.docsContent, styles.intro)}>
				{children}
			</div>
		</div>
	</header>
)

/** The rest of the page, in the frame's middle column. */
export const DocPageBody = ({ children }: { children?: ReactNode }) => (
	<article className={cn(mdxStyles.docsContent, styles.body)}>
		{children}
	</article>
)
