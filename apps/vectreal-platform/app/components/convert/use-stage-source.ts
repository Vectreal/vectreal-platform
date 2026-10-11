import { useCallback, useRef, useState } from 'react'

import { convertRecipeKey } from '../../lib/convert/convert-recipe'

import type { Conversion } from './converter-surface.utils'

/**
 * The recipe a document satisfies the moment it has been read.
 *
 * The optimizer ingests the adopted model straight from its source, with no
 * destructive pass applied, and everything that reads the document waits for
 * that ingest first (`stageIngest`). That is a known state, and saying `null`
 * for it said "unknown" - which `prepare` can never match, so the very first
 * Convert undid a pass that was never applied, on every page including the
 * ones offering no options at all. When undoing meant reading the file again,
 * that unmounted the viewer and spun for seconds on work already done.
 *
 * `dropSource` keeps `null`, because there the document is genuinely gone.
 */
export const INGESTED_RECIPE = convertRecipeKey('doc', [])

/**
 * The model on the converter's stage, as everything that describes it: its
 * size, the conversions made from it, which load put it there, and which
 * destructive passes its document carries.
 *
 * A model arrives and leaves only through `adoptSource` and `dropSource`, which
 * move all of it in one step. Between the two, the surface still files
 * conversions and records the passes `prepare` applies, through the setter and
 * the refs this returns.
 */
export function useStageSource() {
	/* The size of what is on the stage, which every reduction is measured against. */
	const [sourceBytes, setSourceBytes] = useState<number | null>(null)
	const [conversions, setConversions] = useState<Record<string, Conversion>>({})

	/*
	  Whether the model on the stage is still the one this page is about.

	  THIS IS THE LOADER'S CLOCK, NOT A SECOND ONE. `load` hands back a
	  `stillOnScreen` predicate, and this ref holds the one belonging to
	  whichever load the page adopted. It was a monotonic counter of our own
	  until the hook could answer the question, and a counter is what has to be
	  remembered at every site that retires a load - which is how "Convert
	  another" came to empty the stage while a drop still in flight put the
	  source back: `reset()` retired the load and nothing moved the counter.

	  ON SCREEN, NOT NEWEST. A refused drop is the newest load, but it leaves
	  this model on the stage and in the optimizer. Asking whether the adopted
	  load was still the newest made every refusal retire a model that was still
	  there, so a conversion running through one was thrown away with a message
	  about a newer file that did not exist.

	  Asked, never cached. A drop can land during a texture re-encode or a GLB
	  write as easily as during a parse, so the answer is only good at the
	  instant it is read.
	*/
	const stageLoad = useRef<(() => boolean) | null>(null)

	/*
	  Settles once the optimizer has ingested the model the page adopted.

	  The loader shows a model before the optimizer holds it, so until this
	  settles the optimizer's document is still the previous model's. Convert
	  pressed in that window exported the previous model under the new file's
	  name, so everything that reads the document waits for this first.

	  Handed over on adoption, not when a load starts: a drop that is refused
	  never reaches the stage, and waiting on its load waited on nothing.
	*/
	const stageIngest = useRef<Promise<void> | null>(null)

	/*
	  Which destructive passes the document in memory has been given. Not state,
	  because nothing renders from it: it describes the optimizer's document, and
	  the only question asked of it is whether that document already matches what
	  is about to be exported.
	*/
	const appliedKey = useRef<string | null>(null)

	/*
	  What the pass behind `appliedKey` could not do, said beside every result
	  exported from that document, not only the one that ran it.
	*/
	const appliedNote = useRef<string | undefined>(undefined)

	/*
	  Everything that describes the model on the stage, moved in one step.
	
	  These were once written and cleared separately in two places each, and the
	  cost was not tidiness: any path that changed the model without visiting
	  every clear site left them disagreeing - the stored result of one file
	  offered as another's, an `appliedKey` claiming a destructive pass on a
	  document that never had one. One writer means they cannot drift apart.
	*/
	const adoptSource = useCallback(
		(bytes: number, stillOnScreen: () => boolean, ingested: Promise<void>) => {
			setSourceBytes(bytes)
			// Every stored result describes bytes that came from the file replaced.
			setConversions({})
			appliedKey.current = INGESTED_RECIPE
			appliedNote.current = undefined
			stageLoad.current = stillOnScreen
			stageIngest.current = ingested
		},
		[]
	)

	const dropSource = useCallback(() => {
		setSourceBytes(null)
		setConversions({})
		appliedKey.current = null
		appliedNote.current = undefined
		stageLoad.current = null
		stageIngest.current = null
	}, [])

	return {
		sourceBytes,
		conversions,
		setConversions,
		stageLoad,
		stageIngest,
		appliedKey,
		appliedNote,
		adoptSource,
		dropSource
	}
}
