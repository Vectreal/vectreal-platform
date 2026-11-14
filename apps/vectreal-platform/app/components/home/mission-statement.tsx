import { cn } from '@shared/utils'

import styles from './mission-statement.module.css'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

import type { CSSProperties } from 'react'

const COPY = HOME_PAGE_COPY.mission

/* Each key phrase's place among the key phrases, which staggers when it lights. */
const keyIndex = (part: number) =>
	COPY.statement
		.slice(0, part)
		.filter((one) => typeof one !== 'string' && 'key' in one).length

/**
 * Why the company exists: one paragraph, signed.
 *
 * The statement is set large and muted, and its key phrases light up one after
 * another as it scrolls through the middle of the screen, so a reader skimming
 * past still takes away what it says. That is the section's one effect: the
 * floor under it is a still backdrop, and nothing else moves. It is the
 * browser's own scroll timeline, with no script: where it has none, or motion
 * is reduced, the phrases are simply lit.
 */
export const MissionStatement = () => (
	<figure className="max-w-2xl">
		<blockquote
			className={cn('text-h2 text-muted-foreground', styles.statement)}
			data-reveal
		>
			{COPY.statement.map((part, i) =>
				typeof part === 'string' ? (
					part
				) : 'highlight' in part ? (
					// The problem, in full ink from the start: it does not wait to light up like the key phrases. The brand is kept for the promise the paragraph ends on, so a screen carries one orange phrase.
					<span key={part.highlight} className="text-foreground">
						{part.highlight}
					</span>
				) : (
					<span
						key={part.key}
						className={styles.key}
						style={{ '--k': keyIndex(i) } as CSSProperties}
					>
						{part.key}
					</span>
				)
			)}
		</blockquote>
		<figcaption
			data-reveal
			className="text-muted-foreground text-body-sm mt-8 flex items-center gap-4"
		>
			<span className="ds-divider h-px w-8" aria-hidden="true" />
			{COPY.signature}
		</figcaption>
	</figure>
)
