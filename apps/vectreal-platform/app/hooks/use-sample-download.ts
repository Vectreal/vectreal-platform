import { useCallback, useState } from 'react'

import { fetchSampleModel, sampleModelById } from '../lib/samples/sample-models'

/** The sample on its way down, and how much of it has arrived, in whole percent. */
export type SampleDownload = { id: string; percent: number } | null

/**
 * Opens a sample: downloads it, then hands the file to `use`, the same path a
 * dropped file takes.
 *
 * The download is the only part of opening a sample that no surface could
 * show. Both the publisher and the converter have a loading state of their
 * own, but it starts once the loader has the file, and fetching it was done
 * inside each surface's click handler with nothing on screen. `download` spans
 * the fetch and the hand-off, so it ends only after the surface's own state
 * has taken over, with no idle frame between the two.
 *
 * Rejects when the fetch or `use` does; each surface says so in its own words.
 */
export function useSampleDownload() {
	const [download, setDownload] = useState<SampleDownload>(null)

	const openSample = useCallback(
		async (id: string, use: (file: File) => unknown) => {
			const sample = sampleModelById(id)
			if (!sample) return

			setDownload({ id, percent: 0 })
			try {
				const file = await fetchSampleModel(sample, (fraction) => {
					const percent = Math.floor(fraction * 100)
					// One render per percent, not per chunk: the 18 MB camera arrives in hundreds.
					setDownload((current) =>
						current?.percent === percent ? current : { id, percent }
					)
				})
				await use(file)
			} finally {
				setDownload(null)
			}
		},
		[]
	)

	return { download, openSample }
}

export type SampleDownloader = ReturnType<typeof useSampleDownload>
