import { IMPORTABLE_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { Link } from 'react-router'

import {
	CONVERT_INDEX_PATH,
	CONVERT_PAIRS,
	convertPairPath
} from '../../lib/convert/convert-pairs'

const COPY = {
	label: 'Convert 3D files online. For free.',
	lead: 'Each one converts in your browser, with no account and no upload.'
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
 * The formats, low on the page, set as large type in one row.
 *
 * Still, not a carousel: five names fit across the measure, and a loop would
 * only move them out of reach. The brand is the hover, the one thing the row
 * asks the reader to do.
 */
export const FormatStrip = () => (
	<div className="flex flex-col gap-8">
		<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
			<h2 className="text-eyebrow text-muted-foreground" data-reveal>
				{COPY.label}
			</h2>
			<p className="text-muted-foreground text-body-sm" data-reveal>
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
	</div>
)
