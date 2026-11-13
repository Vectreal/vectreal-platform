import { formatFileSize } from '@shared/utils'

import { SAMPLE_MODELS } from '../../lib/samples/sample-models'

import type { SampleModel } from '../../lib/samples/sample-models'
import type { FC } from 'react'

interface Props {
	/** Called with the sample's id. Both surfaces load it the same way. */
	onOpen: (id: string) => void
	/** What the row of tiles is for, said once above them. */
	label: string
	className?: string
	/** Which samples to offer. The publisher offers all of them; the converter only the two that show its passes. */
	samples?: SampleModel[]
}

/**
 * Models you can open, shown rather than described.
 *
 * Both the converter's empty state and the publisher's empty stage used to offer
 * these as a sentence - "Nothing to hand? Open Rocket (944 KB, mostly geometry)
 * or Bike (13 MB, 50 textures)." That asks someone to click a thing they cannot
 * see, in more words than the thing itself would take, on a product whose
 * argument is that we render 3D well. The picture is the invitation; the text
 * under it is the part a picture cannot carry, which is the size.
 *
 * The previews are transparent PNGs trimmed to the model, so one file works on
 * the light surface and the dark one without a second asset or a filter.
 */
export const SampleTiles: FC<Props> = ({
	onOpen,
	label,
	className,
	samples = SAMPLE_MODELS
}) => (
	<div className={className}>
		<p className="text-muted-foreground text-eyebrow mb-3">{label}</p>

		<ul className="grid grid-cols-2 gap-4 sm:max-w-md">
			{samples.map((sample) => (
				<li key={sample.id}>
					<button
						type="button"
						onClick={() => onOpen(sample.id)}
						// `h-full`: the captions are different lengths and one wraps to a
						// second line at 375px, which left the two tiles different
						// heights in a two-column grid.
						className="group ds-raised-interactive relative block h-full w-full rounded-xl p-3 text-left transition-[background-color,box-shadow]"
					>
						{/*
						  `alt=""`: the button is already named by the text below, and a
						  screen reader gains nothing from "Rocket" twice. Lazy, because
						  on the converter these sit below the fold on a phone.
						*/}
						<img
							src={sample.previewUrl}
							alt=""
							loading="lazy"
							className="mb-3 aspect-[4/3] w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
						/>
						<span className="text-foreground block text-sm font-medium">
							{sample.label}
						</span>
						{/*
						  Two lines rather than one joined by a separator: at 375px the
						  joined version wrapped mid-phrase, and where it broke depended on
						  which model it was.
						*/}
						<span className="text-muted-foreground block text-xs tabular-nums">
							{formatFileSize(sample.bytes)}
						</span>
						<span className="text-muted-foreground block text-xs">
							{sample.hint}
						</span>
					</button>
				</li>
			))}
		</ul>
	</div>
)
