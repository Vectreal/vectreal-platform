import { cn } from '@shared/utils'

import { Reveal } from './reveal'
import styles from './sheet-frame.module.css'

import type { ComponentProps, ReactNode } from 'react'

/**
 * The marketing page's frame: column rules down the measure's edges and a
 * rule above every band. A page head or hero runs edge to edge above it; the
 * sections below it are `Band`s.
 */
export const SheetFrame = ({ children }: { children: ReactNode }) => (
	<div className={styles.sheet}>
		<div aria-hidden="true" className={styles.rules} />
		{children}
	</div>
)

/**
 * One section of a `SheetFrame`: a rule across the page above it and a padded
 * cell inside the rules. Its `data-reveal` blocks come in the first time it
 * scrolls into view.
 */
export const Band = ({
	children,
	flush = false,
	inverted = false,
	backdrop,
	className,
	...props
}: ComponentProps<'section'> & {
	/** The last row is ruled into the frame, so the band ends on the sheet's rule rather than in padding. */
	flush?: boolean
	/** The page's one break: the band runs to both edges in the opposite scheme. */
	inverted?: boolean
	/** Drawn behind the whole band, edge to edge, rather than inside the rules. */
	backdrop?: ReactNode
}) => (
	<section
		{...props}
		className={cn(styles.band, inverted && styles.inverted, className)}
	>
		{backdrop}
		<div className={styles.cell} data-flush={flush ? '' : undefined}>
			<Reveal>{children}</Reveal>
		</div>
	</section>
)
