import { cn, formatFileSize } from '@shared/utils'

import { SAMPLE_MODELS, sampleModelById } from '../../lib/samples/sample-models'

import type { SampleDownload } from '../../hooks/use-sample-download'
import type { FC } from 'react'

interface Props {
	/** Called with the sample's id. Both surfaces load it the same way. */
	onOpen: (id: string) => void
	/** What the row of tiles is for, said once above them. */
	label: string
	className?: string
	/** The sample on its way down, from `useSampleDownload`: its tile shows how far, and neither takes a second click. */
	download?: SampleDownload
}

/**
 * Two models you can open, shown rather than described.
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
	download = null
}) => (
	<div className={className}>
		<p className="text-muted-foreground text-eyebrow mb-3">{label}</p>

		<ul className="grid grid-cols-2 gap-4 sm:max-w-md">
			{SAMPLE_MODELS.map((sample) => {
				const isDownloading = download?.id === sample.id
				return (
					<li key={sample.id}>
						<button
							type="button"
							// Not `disabled`: that would drop keyboard focus off the tile that was just pressed.
							aria-disabled={download ? true : undefined}
							aria-busy={isDownloading || undefined}
							onClick={() => {
								if (download) return
								onOpen(sample.id)
							}}
							className={cn(
								// `h-full`: the captions are different lengths and one wraps to a
								// second line at 375px, which left the two tiles different
								// heights in a two-column grid.
								'group relative block h-full w-full rounded-xl p-3 text-left transition-[background-color,opacity]',
								// The ladder's own hover step, as the publisher's scene tiles beside
								// these use; flat while a download holds them.
								download ? 'ds-raised cursor-default' : 'ds-raised-interactive',
								download && !isDownloading && 'opacity-50'
							)}
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
								className={cn(
									'mb-3 aspect-[4/3] w-full object-contain transition-[transform,opacity] duration-200',
									isDownloading ? 'opacity-60' : 'group-hover:scale-[1.03]'
								)}
							/>
							<span className="text-foreground block text-sm font-medium">
								{sample.label}
							</span>
							{/*
							  Two lines rather than one joined by a separator: at 375px the
							  joined version wrapped mid-phrase, and where it broke depended on
							  which model it was.

							  While it downloads, the size line says how far: it is the line
							  that was already about the download.
							*/}
							<span className="text-muted-foreground block text-xs tabular-nums">
								{isDownloading
									? `Downloading, ${download.percent}%`
									: formatFileSize(sample.bytes)}
							</span>
							<span className="text-muted-foreground/70 block text-xs">
								{sample.hint}
							</span>
							{/* In the tile's padding, so it reports progress without moving anything. */}
							{isDownloading && (
								<span
									aria-hidden="true"
									className="ds-sunken absolute inset-x-3 bottom-1.5 h-0.5 overflow-hidden rounded-full"
								>
									<span
										className="bg-orange block h-full rounded-full transition-[width] duration-(--duration-fast) motion-reduce:transition-none"
										style={{ width: `${download.percent}%` }}
									/>
								</span>
							)}
						</button>
					</li>
				)
			})}
		</ul>
		{/* Said once as it starts, not at every percent. */}
		<p aria-live="polite" className="sr-only">
			{download
				? `Downloading ${sampleModelById(download.id)?.label ?? 'the sample'}`
				: ''}
		</p>
	</div>
)
