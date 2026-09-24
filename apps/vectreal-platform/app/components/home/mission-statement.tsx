import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.mission

/**
 * Why the company exists, in one paragraph and one voice.
 *
 * Set large and left alone. A signed statement reads as a person meaning it,
 * and giving it a section of its own is what stops it reading as a tagline.
 */
export const MissionStatement = () => (
	<figure className="max-w-4xl">
		<p className="text-eyebrow text-muted-foreground" data-reveal>
			{COPY.label}
		</p>
		<blockquote className="text-h3 mt-8 max-w-3xl" data-reveal>
			{COPY.statement}
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
