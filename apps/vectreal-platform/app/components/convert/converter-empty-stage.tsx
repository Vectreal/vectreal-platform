import { Button } from '@shared/components/ui/button'
import { FolderUp, Loader2 } from 'lucide-react'

import { articleFor, type ConvertPair } from '../../lib/convert/convert-pairs'
import { DitherGrain } from '../layout-components/dither-grain'
import { DitherSwap } from '../layout-components/dither-swap'
import { SampleTiles } from '../layout-components/sample-tiles'

import type { useSampleDownload } from '../../hooks/use-sample-download'
import type { BundleSourceCopy } from '../../lib/convert/convert-capabilities'
import type { useModelContext } from '@vctrl/hooks/use-load-model'

interface Props {
	pair: ConvertPair
	status: ReturnType<typeof useModelContext>['status']
	progress: number
	bundleCopy: BundleSourceCopy | null
	isBundle: boolean
	onChooseFile: () => void
	onChooseFolder: () => void
	onOpenSample: (id: string) => void
	sampleDownload: ReturnType<typeof useSampleDownload>['download']
}

/**
 * The converter's stage before there is a model on it: the invitation to drop
 * one, or the read progress while one loads.
 *
 * Anchored bottom-left rather than centred. A centred glyph over centred copy
 * over a centred outline button is the stock empty state; putting the
 * invitation where a caption would sit leaves the stage reading as a stage,
 * which is what it becomes one second later.
 *
 * On a wide screen the invitation keeps the bottom-left and the samples take
 * the bottom-right, so the stage's full width is a composition rather than a
 * caption with empty space beside it. The grain is the page's own, rising from
 * the right; it belongs to the empty stage and goes when a model arrives.
 *
 * What it offers depends on the source, samples for GLB and a folder for a
 * glTF bundle, so switching source dissolves the new offer in rather than
 * cutting to it. The grain stays put: it is the stage, not the offer.
 */
export function ConverterEmptyStage({
	pair,
	status,
	progress,
	bundleCopy,
	isBundle,
	onChooseFile,
	onChooseFolder,
	onOpenSample,
	sampleDownload
}: Props) {
	return (
		<>
			<DitherGrain origin="right" />
			<DitherSwap
				as="div"
				value={pair.from}
				className="grid min-h-[17rem] content-end gap-8 p-6 sm:min-h-[20rem] sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
			>
				{status === 'loading' ? (
					<p
						aria-live="polite"
						className="text-muted-foreground flex items-center gap-2 text-sm"
					>
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						Reading your {pair.fromLabel}, {Math.round(progress)}%
					</p>
				) : (
					<>
						<div>
							<p className="text-h3 text-foreground max-w-sm">
								Drop{' '}
								{bundleCopy
									? bundleCopy.dropTarget
									: `${articleFor(pair.fromLabel)} ${pair.fromLabel} file`}{' '}
								here
							</p>
							{/*
							  The only line here, and only for a bundle source: the one
							  thing someone needs to know before they drop. Everything else
							  the old empty state said - read in your browser, no upload, no
							  account - the page heading two inches away says already.
							*/}
							{bundleCopy && (
								<p className="text-muted-foreground text-body-sm mt-4 max-w-md">
									{bundleCopy.instruction}
								</p>
							)}

							<div className="mt-8 flex flex-wrap items-center gap-2">
								<Button onClick={onChooseFile}>
									{bundleCopy
										? bundleCopy.chooseLabel
										: `Choose ${articleFor(pair.fromLabel)} ${pair.fromLabel} file`}
								</Button>
								{isBundle && (
									<Button variant="outline" onClick={onChooseFolder}>
										<FolderUp className="h-4 w-4" aria-hidden />
										Choose a folder
									</Button>
								)}
							</div>
						</div>

						{/*
						  Samples are GLB, so they are offered where GLB is what the
						  page reads. Building a glTF bundle at runtime to sample the
						  glTF pages would be a fixture pretending to be a file
						  somebody exported.
						*/}
						{pair.from === 'glb' && (
							<SampleTiles
								className="lg:w-md"
								label="Or open one of these"
								onOpen={onOpenSample}
								download={sampleDownload}
							/>
						)}
					</>
				)}
			</DitherSwap>
		</>
	)
}
