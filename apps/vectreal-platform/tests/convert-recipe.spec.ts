import { describe, expect, it } from 'vitest'

import {
	CONVERT_PAIRS,
	convertOptionsFor,
	OPTIONS_BY_TARGET,
	type ConvertOption
} from '../app/lib/convert/convert-pairs'
import {
	activeConvertOptions,
	conversionKeyFor,
	convertRecipeKey,
	storeConversion
} from '../app/lib/convert/convert-recipe'

/*
  The rule these hold: a conversion result is valid only for the target and the
  option set that produced it.

  It was enforced by hand in three places that each watched a different event - a
  toggle cleared the result, a pair change cleared it through an effect, and a
  boolean tracked what the live document had been given - so the case none of
  them watched shipped a USDZ offered for download from the glTF page. The key
  replaces all three, which is why it is worth a spec of its own rather than a
  render test: the defect is arithmetic on identity, not layout.
*/
describe('a conversion is stamped with its recipe', () => {
	it('separates two pages that write the same format', () => {
		/*
		  Through `conversionKeyFor` and the real manifest, because the defect
		  was the surface choosing the wrong half of the pair: asserting on
		  `convertRecipeKey` with two strings picked here would pass whatever
		  the page went on to key its results by.

		  The model and the surface both outlive a move along the rail, so a
		  result keyed by its target alone reappeared on the next page writing
		  that format - under that page's title, that page's note about its own
		  source, and a reduction measured against a file it never saw.
		*/
		const keys = CONVERT_PAIRS.map((pair) => conversionKeyFor(pair, []))

		/*
		  Over every pair, not just the ones sharing a target. Filtering to one
		  target catches a key scoped by `to` and misses one scoped by `from`,
		  which re-creates the same leak along the other axis: `glb-to-gltf` and
		  `glb-to-usdz` would share `glb:` and offer each other's download.
		*/
		expect(new Set(keys).size).toBe(keys.length)
		expect(keys.length).toBeGreaterThan(1)
	})

	it('separates two targets built from the same options', () => {
		expect(convertRecipeKey('glb', [])).not.toBe(convertRecipeKey('usdz', []))
	})

	it('separates two option sets written to the same target', () => {
		expect(convertRecipeKey('glb', [])).not.toBe(
			convertRecipeKey('glb', ['draco'])
		)
	})

	/*
	  Order is how the reader ticked the boxes, not part of the recipe. Without
	  this the same conversion is re-run whenever somebody unticks and re-ticks in
	  a different order, and the cache silently never hits.
	*/
	it('does not depend on the order the options were ticked', () => {
		expect(convertRecipeKey('glb', ['draco', 'webp'])).toBe(
			convertRecipeKey('glb', ['webp', 'draco'])
		)
	})

	/*
	  The specific shape of the bug: the pair changes without the surface
	  unmounting, which is deliberate - it is what lets one dropped file be
	  converted to several formats. So every pair has to produce a key of its own
	  from the same ticked boxes, or a result outlives the page that made it.
	*/
	it('gives every shipped pair a key nothing else can collide with', () => {
		const keys = CONVERT_PAIRS.map((pair) =>
			convertRecipeKey(pair.to, convertOptionsFor(pair))
		)

		expect(new Set(keys).size).toBe(
			new Set(CONVERT_PAIRS.map((p) => p.to)).size
		)
	})
})

describe('ticks the target cannot honour are dropped', () => {
	/*
	  `selected` is deliberately not reset when the pair changes, so a box stays
	  ticked across a detour. That only works if the recipe ignores a tick the
	  current target has no pass for - otherwise carrying `draco` onto a glTF page
	  would describe a conversion that never ran.
	*/
	/*
	  The offered lists are written out rather than read from
	  `OPTIONS_BY_TARGET`, and the first version of this test did read them - so
	  when Draco turned out to belong on glTF targets too, a test about filtering
	  failed for a reason that had nothing to do with filtering. What each target
	  offers is `convert-pairs.spec.ts`'s rule; this one owns only what happens to
	  a tick the target does not offer.
	*/
	it('keeps only what the target actually offers', () => {
		const ticked: ConvertOption[] = ['draco', 'webp']

		expect(activeConvertOptions(ticked, ['webp'])).toEqual(['webp'])
		expect(activeConvertOptions(ticked, [])).toEqual([])
		expect(activeConvertOptions(ticked, ['draco', 'webp'])).toEqual([
			'draco',
			'webp'
		])
	})

	/*
	  USDZ is written from the three.js scene, not the document the passes
	  operate on, so an option surviving onto it would run, report success and
	  change nothing in the downloaded file.
	*/
	it('leaves a USDZ recipe identical however the boxes were left', () => {
		const bare = convertRecipeKey(
			'usdz',
			activeConvertOptions([], OPTIONS_BY_TARGET.usdz)
		)
		const carried = convertRecipeKey(
			'usdz',
			activeConvertOptions(['draco', 'webp'], OPTIONS_BY_TARGET.usdz)
		)

		expect(carried).toBe(bare)
	})
})

describe('conversions are kept until the cap is actually exceeded', () => {
	/*
	  The case that shipped broken, and the reason this is a function rather than
	  four lines in the component. The eviction read
	  `keys.slice(0, keys.length - limit)`, which means "everything past the cap"
	  only once the cap is passed: at two entries under a limit of three it is
	  `slice(0, -1)`, every key but the last. So converting a second format threw
	  the first result away, and a cache built to survive a detour held one item.
	*/
	it('keeps an earlier conversion when the cap is not reached', () => {
		let kept = storeConversion({}, 'usdz:', 'a', 3)
		kept = storeConversion(kept, 'gltf:', 'b', 3)

		expect(Object.keys(kept).sort()).toEqual(['gltf:', 'usdz:'])
	})

	it('evicts only once there are more than the cap allows', () => {
		let kept = storeConversion({}, 'one', 1, 3)
		kept = storeConversion(kept, 'two', 2, 3)
		kept = storeConversion(kept, 'three', 3, 3)

		expect(Object.keys(kept)).toHaveLength(3)

		kept = storeConversion(kept, 'four', 4, 3)

		expect(Object.keys(kept)).toEqual(['two', 'three', 'four'])
	})

	/*
	  Re-running a recipe that is already held makes it the most recent, not the
	  next to go. Without the re-insert it keeps its original position and the
	  conversion someone just asked for is the first thing evicted.
	*/
	it('treats a re-run recipe as the most recent', () => {
		let kept = storeConversion({}, 'one', 1, 3)
		kept = storeConversion(kept, 'two', 2, 3)
		kept = storeConversion(kept, 'three', 3, 3)
		kept = storeConversion(kept, 'one', 11, 3)
		kept = storeConversion(kept, 'four', 4, 3)

		expect(Object.keys(kept)).toEqual(['three', 'one', 'four'])
		expect(kept.one).toBe(11)
	})

	it('does not mutate the map it was given', () => {
		const before = { 'usdz:': 'a' }
		storeConversion(before, 'gltf:', 'b', 1)

		expect(before).toEqual({ 'usdz:': 'a' })
	})
})
