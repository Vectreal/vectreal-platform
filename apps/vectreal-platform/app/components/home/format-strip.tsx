import { IMPORTABLE_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { Link } from 'react-router'

import { ArrowLink } from './arrow-link'
import {
	CONVERT_INDEX_PATH,
	CONVERT_PAIRS,
	convertPairPath
} from '../../lib/convert/convert-pairs'

const COPY = {
	heading: 'Convert 3D files online. For free.',
	lead: 'Each one converts in your browser, with no account and no upload.',
	all: 'All converters'
} as const

/*
  Every format the loader reads, from the format table, so the strip cannot
  name one it does not read or leave one out. Each links to the first converter
  that reads it, which gives the row a job beyond listing.
*/
const FORMATS = IMPORTABLE_FORMAT_IDS.map((id) => {
	const pair = CONVERT_PAIRS.find((one) => one.from === id)
	return {
		id,
		label: modelFormat(id).label,
		to: pair ? convertPairPath(pair) : CONVERT_INDEX_PATH
	}
})

/**
 * The converters, last on the page: a product of their own, free and with no
 * account, rather than a feature of the one above. The formats are set as
 * large type in one row, straight on the page: a surface around five words
 * only boxed the type in.
 *
 * Still, not a carousel: five names fit across the measure, and a loop would
 * only move them out of reach. The brand is the hover, the one thing the row
 * asks the reader to do.
 */
export const FormatStrip = () => (
	<div className="flex flex-col gap-10">
		<div className="flex flex-col gap-4">
			<h2 id="converter-heading" className="text-h2" data-reveal>
				{COPY.heading}
			</h2>
			<p className="text-muted-foreground text-body-lg" data-reveal>
				{COPY.lead}
			</p>
		</div>
		<ul
			className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4"
			data-reveal
		>
			{FORMATS.map((format) => (
				<li key={format.id}>
					<Link
						to={format.to}
						className="text-headline hover:text-orange-ink focus-visible:text-orange-ink transition-colors"
					>
						.{format.label}
					</Link>
				</li>
			))}
		</ul>
		<ArrowLink
			to={CONVERT_INDEX_PATH}
			viewTransition
			className="text-foreground"
		>
			{COPY.all}
		</ArrowLink>
	</div>
)
