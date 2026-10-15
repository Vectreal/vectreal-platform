/*
  Whether the hero's stage has finished putting its camera on the GPU, live or
  given up, so another stage on the page can start its own without the two
  competing.

  A WebGL stage's first frame stalls WebKit's GPU process for 140 to 180 ms
  however its uploads are spread, so when it starts decides where the stall
  lands. The product window's stage used to start when the window scrolled into
  view, which put that stall mid-scroll every time. Started once the hero has
  settled, it lands while the reader is still on the hero.

  Module state, not React state: the hero and the product window are siblings
  with no shared owner, and once the hero has settled it stays settled for the
  life of the page.
*/
let settled = false
const waiting = new Set<() => void>()

/** The hero's stage is live, or could not run: either way it is done with the GPU. */
export function markHeroSettled() {
	if (settled) return
	settled = true
	for (const run of waiting) run()
	waiting.clear()
}

/** Runs `run` once the hero has settled, at once if it already has; returns a cancel. */
export function whenHeroSettled(run: () => void): () => void {
	if (settled) {
		run()
		return () => {}
	}
	waiting.add(run)
	return () => waiting.delete(run)
}

/** For specs: back to a page that has not settled. */
export function resetHeroSettled() {
	settled = false
	waiting.clear()
}
