import {
	describeSizeChange,
	FileSizeComparison
} from '../layout-components/file-size-comparison'

import type { Conversion } from './converter-surface.utils'
import type { ConvertPair } from '../../lib/convert/convert-pairs'

interface Props {
	pair: ConvertPair
	sourceBytes: number | null
	result: Conversion
}

/** What a conversion achieved, measured against the model on the stage. */
export function ConversionResult({ pair, sourceBytes, result }: Props) {
	return (
		/*
		  `ds-raised`, matching the index: a container sitting on the page
		  rather than a well you put something into. The stage above is the
		  well.
		*/
		<div className="ds-raised rounded-2xl p-6">
			<p className="text-muted-foreground text-eyebrow mb-1">
				{pair.fromLabel} to {pair.toLabel}
			</p>
			<FileSizeComparison
				sizeInfo={{
					initialSceneBytes: sourceBytes,
					currentSceneBytes: result.bytes.byteLength
				}}
				{...describeSizeChange(sourceBytes, result.bytes.byteLength)}
			/>
			{result.note && (
				<p className="text-foreground pb-2 text-sm">{result.note}</p>
			)}
			{pair.note && (
				<p className="text-muted-foreground pb-2 text-sm">{pair.note}</p>
			)}
		</div>
	)
}
