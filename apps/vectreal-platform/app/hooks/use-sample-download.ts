import { useCallback, useState } from 'react'

import { exampleSceneById } from '../lib/samples/example-scenes'
import { fetchSampleModel, sampleModelById } from '../lib/samples/sample-models'

import type { ExampleScene } from '../lib/samples/example-scenes'

/** The sample on its way down, and how much of it has arrived, in whole percent. */
export type SampleDownload = { id: string; percent: number } | null

/**
 * Opens a sample: downloads it, then hands the file to `handOff`, the same path a
 * dropped file takes.
 *
 * The download is the only part of opening a sample that no surface could
 * show. Both the publisher and the converter have a loading state of their
 * own, but it starts once the loader has the file, and fetching it was done
 * inside each surface's click handler with nothing on screen. `download` spans
 * the fetch and the hand-off, so it ends only after the surface's own state
 * has taken over, with no idle frame between the two.
 *
 * Rejects when the fetch or `handOff` does; each surface says so in its own words.
 */
export function useSampleDownload() {
	const [download, setDownload] = useState<SampleDownload>(null)

	const openModel = useCallback(
		async (
			id: string,
			model: Parameters<typeof fetchSampleModel>[0],
			handOff: (file: File) => unknown
		) => {
			setDownload({ id, percent: 0 })
			try {
				const file = await fetchSampleModel(model, (fraction) => {
					const percent = Math.floor(fraction * 100)
					// One render per percent, not per chunk: the 18 MB camera arrives in hundreds.
					setDownload((current) =>
						current?.percent === percent ? current : { id, percent }
					)
				})
				await handOff(file)
			} finally {
				setDownload(null)
			}
		},
		[]
	)

	const openSample = useCallback(
		async (id: string, handOff: (file: File) => unknown) => {
			const sample = sampleModelById(id)
			if (!sample) return
			await openModel(id, sample, handOff)
		},
		[openModel]
	)

	/** The same download for an example scene's model; `handOff` applies its settings. */
	const openExample = useCallback(
		async (
			id: string,
			handOff: (example: ExampleScene, file: File) => unknown
		) => {
			const example = exampleSceneById(id)
			if (!example) return
			await openModel(id, example.model, (file) => handOff(example, file))
		},
		[openModel]
	)

	return { download, openSample, openExample }
}

export type SampleDownloader = ReturnType<typeof useSampleDownload>
