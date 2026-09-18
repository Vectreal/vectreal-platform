/**
 * Which file a reference resolves to, and when it resolves to nothing.
 *
 * The six cases under "an asset is found by the path its model would write"
 * are the written record of the bug that started this: `buildAssetLookupKeys`
 * produced a set of hopeful spellings ending in the bare basename, so two
 * `diffuse.png` in sibling folders answered for one another. Nothing tested
 * that, in this package or anywhere - the rule it belonged to had no spec at
 * all - so they are asked here, as the question that actually matters: not
 * which keys exist, but which file you get.
 *
 * Mutation gates, all executed. Counts are cases in THIS file; where the same
 * mutation reddens more of `@vctrl/core`, the package figure follows it. An
 * earlier revision of this header mixed the two and read as though nine cases
 * here protected one line, when five do.
 *
 *  - stop scoping the tail rung and 1 case goes red here, 3 in the package;
 *    stop scoping the name-only rung and 2 go red here, 4 in the package;
 *    tighten `inScope` back to a bare `rootOf(key) === scope` and the
 *    top-of-selection case goes red here, 8 across the package;
 *  - scope the resolve rung like the rest and 3 cases go red: both climb cases
 *    and the sibling-resource one. Three rules tried to scope it and each
 *    refused references exporters really write, which is why it is the one rung
 *    that honours what a reference states;
 *  - delete the `resolveAgainst` rung and 5 cases go red here, 8 in the
 *    package. Every other reference here is answered identically by the tail
 *    rung, which is why those carry a decoy rather than a lone candidate;
 *  - compare the reference verbatim in the read-from-the-root rung, rather than
 *    resolving it against nothing first, and both canonicalization cases go
 *    red. They assert the *wrong file*, not a miss: without the collapse the
 *    reference fell through to the name-only rung;
 *  - drop the `if (found.tied) return undefined` arm of the ladder loop and two
 *    cases go red, the tie-stop one and `still refuses when every spelling
 *    ties`;
 *  - clear `ambiguous` in `shallowestMatch` while still returning the key and 5
 *    cases go red here, 9 in the package;
 *  - rank a root-less key by `split('/').length` (1) rather than last and the
 *    two top-of-selection preference cases go red. That was a real defect, not
 *    a hypothetical: it shipped for one review round;
 *  - remove the empty-list refusal in `resolveAgainst` so a climb clamps to the
 *    root and walks back down, and the climb case goes red;
 *  - drop `if (!stated) return undefined` and the empty-reference case goes
 *    red. That case held no such selection at first and so protected nothing;
 *    it now carries a file named after the model's own directory, which is what
 *    an empty reference resolves to;
 *  - walk the ladder once per spelling instead of trying every spelling at each
 *    rung, and two cases go red: the percent-escape one, and
 *    `refuses when two spellings each name a file, and not the same one` - any
 *    faithful per-spelling walk also returns the first spelling's answer;
 *  - return on the first spelling's tie rather than trying the rest, and the
 *    veto case goes red;
 *  - return the first spelling's answer rather than comparing the two, and the
 *    two-spellings-two-files case goes red;
 *  - swap the resolve and read-from-the-root rungs and the
 *    model's-own-directory-first case goes red. This ordering was once called
 *    structural and ungated here, which was wrong: a folderless key is in every
 *    scope, so a bare reference reaches the second rung whatever the model's
 *    root is;
 *  - drop the `/` from the tail rung's `endsWith` and the redwood case goes red;
 *  - make `withoutLeadingDots` the identity and the ../ anchoring case goes red;
 *  - take the `keyDepth === depth` arm to a bare `else` (any second match is a
 *    tie, rather than the nearest winning) and `prefers the model's own file
 *    over one at the top of the selection` goes red. Not the `lod1` case: its
 *    fixture now lists the deeper file first, so the shallower one takes the
 *    `<` branch and never reaches the tie arm;
 *  - take `keyDepth < depth` to `key === undefined` (first match wins rather
 *    than nearest) and the `lod1` case goes red. It did not until its fixture
 *    was reordered to list the deeper file first: with the nearer one first,
 *    "shallowest wins" and "first wins" agree on every fixture here and the
 *    comparison itself was ungated;
 *  - drop the `decodeReference` pass and two cases go red, the percent-encoded
 *    one and the two-spellings tie - with one spelling there is no cross-spelling
 *    tie left to refuse;
 *  - normalize the reference but not the keys and 4 cases go red: the
 *    upper-case key one, `reads the reference from the selection root only
 *    within scope`, and both climb cases. Not every fixture that spells a
 *    `chairA` or `chairB` root: the two asserting `undefined` stay green,
 *    because dropping key normalization only makes matching stricter;
 *  - return the normalized key rather than the original and the same 4 go red,
 *    the first of them on the value it looked up.
 *
 * EIGHT CASES HERE GATE NOTHING, and saying so beats letting the next reader
 * count them as protection. Each is answered by two or three rungs
 * independently, so no single-line change to any one rung can redden them:
 * `resolves a reference relative to the model`, `keeps two same-named assets in
 * different folders apart`, `resolves the selection-relative spelling too`,
 * `resolves an asset beside the model folder through its ../ reference`,
 * `answers nothing for a reference no file matches`, `resolves against nothing
 * when no model path is given at all`, `strips a leading ./ so both spellings
 * match` and `leaves a flat selection alone`.
 *
 * They are kept because they are the written record of what the rule is for -
 * the second is the bug this module exists to end - and because redundancy at
 * the top of a ladder is what makes the rungs below it safe to change. The
 * basename collision that case commemorates is gated, one layer up, by the
 * `selectionKey` mutation named in `gltf-assets.spec.ts`.
 */
import { describe, expect, it } from 'vitest'

import { referenceIn, referenceKeyIn, selectionKey } from './dropped-selection'

/** A selection, as `siblingsFromFiles` builds one: one key per file. */
function selection(...paths: string[]): Map<string, string> {
	return new Map(paths.map((path) => [path, path]))
}

function fileAt(path: string): File {
	const file = new File(['x'], path.split('/').pop() ?? path)
	if (path.includes('/')) {
		Object.defineProperty(file, 'webkitRelativePath', {
			value: path,
			configurable: true,
			enumerable: true
		})
	}
	return file
}

describe('a file is keyed by where it sits in the selection', () => {
	it('uses the path when the file has one', () => {
		expect(selectionKey(fileAt('chair/body/diffuse.png'))).toBe(
			'chair/body/diffuse.png'
		)
	})

	it('falls back to the name for a loose file', () => {
		expect(selectionKey(fileAt('diffuse.png'))).toBe('diffuse.png')
	})

	it('lower-cases and forward-slashes, so one file has one key', () => {
		const windows = new File(['x'], 'Diffuse.PNG')
		Object.defineProperty(windows, 'webkitRelativePath', {
			value: 'Chair\\Body\\Diffuse.PNG',
			configurable: true,
			enumerable: true
		})

		expect(selectionKey(windows)).toBe('chair/body/diffuse.png')
	})
})

describe('an asset is found by the path its model would write', () => {
	it('resolves a reference relative to the model', () => {
		const files = selection('chair/chair.gltf', 'chair/body/diffuse.png')

		expect(referenceIn(files, 'body/diffuse.png', 'chair/chair.gltf')).toBe(
			'chair/body/diffuse.png'
		)
	})

	it('keeps two same-named assets in different folders apart', () => {
		/*
		  The failure this module exists for: with only the basename to go on,
		  the second file overwrote the first and the model rendered one image
		  twice, reporting no missing assets.
		*/
		const files = selection(
			'chair/chair.gltf',
			'chair/body/diffuse.png',
			'chair/wheels/diffuse.png'
		)

		expect(referenceIn(files, 'body/diffuse.png', 'chair/chair.gltf')).toBe(
			'chair/body/diffuse.png'
		)
		expect(referenceIn(files, 'wheels/diffuse.png', 'chair/chair.gltf')).toBe(
			'chair/wheels/diffuse.png'
		)
	})

	it('resolves the selection-relative spelling too', () => {
		const files = selection('chair/chair.gltf', 'chair/body/diffuse.png')

		expect(
			referenceIn(files, 'chair/body/diffuse.png', 'chair/chair.gltf')
		).toBe('chair/body/diffuse.png')
	})

	it('does not reach into a second folder dropped alongside', () => {
		/*
		  Answering this would be the cross-folder mix-up in another guise: one
		  chair wearing another chair's texture, reported as success.
		*/
		const files = selection('chairA/chair.gltf', 'chairB/body/diffuse.png')

		expect(
			referenceIn(files, 'body/diffuse.png', 'chairA/chair.gltf')
		).toBeUndefined()
	})

	it('resolves an asset beside the model folder through its ../ reference', () => {
		/*
		  The glTF here writes `../textures/wood.png`, and that is exactly what
		  it means - the one stage that can be certain.
		*/
		const files = selection(
			'chair/models/chair.gltf',
			'chair/textures/wood.png'
		)

		expect(
			referenceIn(files, '../textures/wood.png', 'chair/models/chair.gltf')
		).toBe('chair/textures/wood.png')
	})

	it("prefers the model's own directory over a shallower match", () => {
		/*
		  THE CASE THAT NEEDS `resolveAgainst`. Every other reference in this
		  file is answered identically by the tail stage, so deleting the resolve
		  stage outright left the whole spec green - the rule this module owns
		  had no assertion that failed when it was removed.

		  Here the two disagree. A reference is relative to the model, so a glTF
		  at `chair/models/` naming `textures/wood.png` means the copy under
		  `models`. The tail stage prefers the shallowest match and would hand
		  back the one a folder higher, which is a different file.
		*/
		const files = selection(
			'chair/models/chair.gltf',
			'chair/models/textures/wood.png',
			'chair/textures/wood.png'
		)

		expect(
			referenceIn(files, 'textures/wood.png', 'chair/models/chair.gltf')
		).toBe('chair/models/textures/wood.png')
	})

	it('finds a file sitting at the top of the selection', () => {
		/*
		  A REGRESSION THIS SPEC DID NOT CATCH THE FIRST TIME. Scoping compared
		  roots for equality, and a key with no folder has a root of `''`, so
		  once the model sat in a folder every root-less file was excluded from
		  both fallback stages. Two real selections broke: a loose `wood.png`
		  dragged in beside a folder, and every saved scene whose name holds a
		  `/`, because the rebuilt glTF is named after the scene while its
		  assets are stored as flat basenames. Both returned
		  `Missing required image files` for a selection that was complete.
		*/
		const files = selection('chair/chair.gltf', 'wood.png')

		expect(referenceIn(files, 'textures/wood.png', 'chair/chair.gltf')).toBe(
			'wood.png'
		)
	})

	it("prefers the model's own file over one at the top of the selection", () => {
		/*
		  ADMITTED, NOT PREFERRED. The first attempt at the case above put
		  root-less keys in scope and nothing else, which made them the
		  *shallowest* candidates - depth 1 - so a loose stranger beat every
		  correctly-scoped file in the model's own folder. The reference here is
		  an absolute path from the machine the model was authored on, which is
		  exactly what the name-only stage exists for.
		*/
		const files = selection(
			'chair/chair.obj',
			'chair/textures/wood.png',
			'wood.png'
		)

		expect(
			referenceIn(
				files,
				'C:\\Users\\bob\\project\\textures\\wood.png',
				'chair/chair.obj'
			)
		).toBe('chair/textures/wood.png')
	})

	it('does not let a file at the top of the selection break a tie', () => {
		/*
		  The same mistake seen from the contract's side: a depth-1 key never
		  ties with anything, so ranking it first silently turned a refusal into
		  an answer.
		*/
		const files = selection(
			'chair/chair.obj',
			'chair/body/diffuse.png',
			'chair/wheels/diffuse.png',
			'diffuse.png'
		)

		expect(
			referenceIn(files, 'maps/diffuse.png', 'chair/chair.obj')
		).toBeUndefined()
	})

	it("reads the model's own directory before the selection root", () => {
		/*
		  THE RUNG ORDER, WHICH THE HEADER HERE ONCE CALLED STRUCTURAL AND
		  UNGATED. The claim was that a scoped read-from-the-root can only hit
		  when the key's root already equals the model's, so the two orderings
		  are indistinguishable. They are not: a folderless key is in every
		  scope, so a bare reference always passes that rung, and swapping the
		  two reddened nothing in this file.
		*/
		const files = selection('chair/chair.gltf', 'chair/wood.png', 'wood.png')

		expect(referenceIn(files, 'wood.png', 'chair/chair.gltf')).toBe(
			'chair/wood.png'
		)
	})

	it('leaves a flat selection alone', () => {
		const files = selection('chair.gltf', 'diffuse.png')

		expect(referenceIn(files, 'diffuse.png', 'chair.gltf')).toBe('diffuse.png')
	})
})

describe('what a reference reaches, and where it stops', () => {
	it('refuses a genuine tie rather than guessing', () => {
		/*
		  Two subfolders holding a `diffuse.png` are an ordinary export. Picking
		  either textures one part with the other's image and reports success;
		  returning nothing leaves the material its colour, which the page
		  already promises as "correct but grey".
		*/
		const files = selection(
			'chair/chair.gltf',
			'chair/body/diffuse.png',
			'chair/wheels/diffuse.png'
		)

		expect(
			referenceIn(files, 'diffuse.png', 'chair/chair.gltf')
		).toBeUndefined()
	})

	it('prefers the nearest match over a deeper one', () => {
		/*
		  NEAREST, NOT ONLY. There is exactly one file `textures/wood.png` can
		  mean here, because naming the other one requires saying `lod1/`.

		  The model sits a folder down so the reference does not resolve exactly
		  - `chair/models/textures/wood.png` is not in the selection - which is
		  what puts the question to the tail stage rather than answering it
		  before the ranking runs at all.

		  THE DEEPER FILE IS LISTED FIRST, and that ordering is the assertion.
		  With the nearer one first, "shallowest wins" and "first match wins"
		  agree on every fixture in this file, so the comparison itself was
		  ungated: `if (keyDepth < depth)` could become `if (key === undefined)`
		  with the whole suite green.
		*/
		const files = selection(
			'chair/models/chair.obj',
			'chair/lod1/textures/wood.png',
			'chair/textures/wood.png'
		)

		expect(
			referenceIn(files, 'textures/wood.png', 'chair/models/chair.obj')
		).toBe('chair/textures/wood.png')
	})

	it('stops at a tie rather than falling through to a vaguer rule', () => {
		/*
		  The tail stage ties, and the name-only stage below it would happily
		  answer. A reference this cannot pin down must not then be answered by
		  a looser rule.
		*/
		const files = selection(
			'chair/chair.obj',
			'chair/body/textures/wood.png',
			'chair/wheels/textures/wood.png',
			/*
			  THE DECOY, AND THE WHOLE POINT OF THE CASE. Without a file the
			  name-only stage could answer with, both stages return nothing and
			  the assertion passes whether or not the tie stops the walk. This
			  one is shallower and matches on name alone, so dropping the
			  `if (found.tied) return undefined` arm of the ladder loop hands it
			  back.
			*/
			'chair/decoy/wood.png'
		)

		expect(
			referenceIn(files, 'textures/wood.png', 'chair/chair.obj')
		).toBeUndefined()
	})

	it('answers nothing for a reference no file matches', () => {
		const files = selection('chair/chair.gltf', 'chair/body/diffuse.png')

		expect(referenceIn(files, 'normal.png', 'chair/chair.gltf')).toBeUndefined()
	})

	it('answers nothing for an empty reference', () => {
		/*
		  THE SELECTION HOLDS THE ANSWER THE GUARD REFUSES. An empty reference
		  resolves against the model's own directory to that directory, so a
		  folder carrying an extensionless file of the same name would have it
		  handed back. The first version of this case dropped the guard and
		  stayed green, because nothing in its selection could be reached that
		  way - it asserted the absence of an answer nobody could have given.
		*/
		const files = selection('chair/chair.gltf', 'chair/diffuse.png', 'chair')

		expect(referenceIn(files, '', 'chair/chair.gltf')).toBeUndefined()
	})

	it('refuses to climb out of the selection', () => {
		/*
		  Popping an empty segment list clamped the path to the root and walked
		  back down, so this resolved to the other dropped folder's file. This is
		  the half the arithmetic owns; the case below is the half it does not.
		*/
		const files = selection('chairA/chair.obj', 'chairB/textures/wood.png')

		expect(
			referenceIn(files, '../../chairB/textures/wood.png', 'chairA/chair.obj')
		).toBeUndefined()
	})

	it('follows an explicit climb into a folder dropped beside it', () => {
		/*
		  THE TRADE, WRITTEN DOWN. A reference that says `../chairB/wood.png`
		  gets `chairB/wood.png`, even though chairB is a second export with its
		  own model. Three rules tried to refuse this and each one, in refusing
		  it, also refused references that exporters really write - see the
		  sibling-resource case below, which is the same rung answering the
		  ordinary drag of `model/` and `textures/` together.

		  What makes this acceptable is that nothing *invents* the crossing: the
		  reference states it. The rungs that would invent one - matching by tail
		  or by bare name - are scoped to the model's own root, and the cases in
		  this file pin that.
		*/
		const files = selection(
			'chairA/chair.obj',
			'chairB/chairB.obj',
			'chairB/wood.png'
		)

		expect(referenceIn(files, '../chairB/wood.png', 'chairA/chair.obj')).toBe(
			'chairB/wood.png'
		)
	})

	it('reads a sibling folder dropped in the same gesture', () => {
		/*
		  THE COST OF READING "ANOTHER ROOT" AS "ANOTHER MODEL". Selecting
		  `model/` and `textures/` in a file manager and dragging both is one
		  export in two roots, and `../textures/wood.png` is what the exporter
		  wrote. Scoping the resolve rung to the model's own root refused it, and
		  every rung below is scoped too, so nothing answered: the OBJ came back
		  grey reporting success and the glTF refused to load.

		  A root earns the refusal by holding a model. This one holds a texture.
		*/
		const files = selection(
			'model/chair.obj',
			'model/chair.mtl',
			'textures/wood.png'
		)

		expect(referenceIn(files, '../textures/wood.png', 'model/chair.obj')).toBe(
			'textures/wood.png'
		)
	})

	it('follows the same climb written with an interior segment', () => {
		/* `a/../../chairB` pops `a` before it pops the root, so the chain never
		   holds two `..` in a row - it is the same statement spelled awkwardly,
		   and it gets the same answer. */
		const files = selection(
			'chairA/chair.obj',
			'chairB/chairB.obj',
			'chairB/wood.png'
		)

		expect(
			referenceIn(files, 'a/../../chairB/wood.png', 'chairA/chair.obj')
		).toBe('chairB/wood.png')
	})
})

describe('every spelling is tried at a rung before the next rung', () => {
	/*
	  Three defects lived here, and none of them was pinned by anything until a
	  review round went looking. All three are about the same mistake in
	  different clothes: treating "which spelling" as more important than "how
	  certain this rung is".
	*/

	it('does not let a tie in one spelling veto a certainty in the other', () => {
		/*
		  The decoded reading of `wood%20grain.png` ties between two folders. The
		  literal reading names one file exactly. Returning on the first tie
		  refused the whole reference - and it was order-dependent, so the same
		  selection answered when the spellings were swapped. On the OBJ path
		  this stripped the `map_Kd` line and greyed a material whose texture was
		  sitting in the selection.
		*/
		const files = selection(
			'chair/models/chair.gltf',
			'chair/a/wood grain.png',
			'chair/b/wood grain.png',
			'chair/textures/wood%20grain.png'
		)

		expect(
			referenceIn(files, 'wood%20grain.png', 'chair/models/chair.gltf')
		).toBe('chair/textures/wood%20grain.png')
	})

	it('reads the reference from the selection root only within scope', () => {
		/*
		  THE LEAK THIS MODULE EXISTS TO PREVENT, reached around the guard. The
		  rung that reads a reference from the selection root is a guess, not a
		  certainty, and it consulted no scope - so a `textures/` folder dropped
		  beside `chairA/` answered chairA's reference in preference to chairA's
		  own `textures/`. No percent-encoding, no exotic names: an ordinary
		  relative reference, a conversion that succeeds and is wrong.
		*/
		const files = selection(
			'chairA/models/chair.obj',
			'chairA/textures/wood.png',
			'textures/wood.png'
		)

		expect(
			referenceIn(files, 'textures/wood.png', 'chairA/models/chair.obj')
		).toBe('chairA/textures/wood.png')
	})

	it('refuses when two spellings each name a file, and not the same one', () => {
		/*
		  A TIE ACROSS SPELLINGS IS STILL A TIE. Both readings of
		  `wood%20grain.png` are legitimate - a glTF writes the space encoded,
		  and a file may genuinely be named with a literal `%20` - so a selection
		  holding one of each has two files that answer perfectly, and the
		  reference has not said which. Answering with the first was the array
		  order deciding: swap the two spellings and the same selection returns
		  the other file.
		*/
		const files = selection(
			'chair/models/chair.obj',
			'chair/a/wood grain.png',
			'chair/b/wood%20grain.png'
		)

		expect(
			referenceIn(files, 'wood%20grain.png', 'chair/models/chair.obj')
		).toBeUndefined()
	})

	it('still refuses when every spelling ties', () => {
		/*
		  The contract the cases above must not have traded away, asked with the
		  two spellings actually in play. It read `diffuse.png` against two
		  `diffuse.png`s - which is one spelling, and letter for letter the same
		  fixture, reference and expectation as `refuses a genuine tie rather
		  than guessing` a hundred lines up. Two names for one case: every
		  mutation that reddened one reddened the other, and its comment
		  described an intent the fixture did not implement.

		  Here the decoded spelling ties between two files and the literal one
		  matches nothing, so no spelling escapes the tie and the walk stops.

		  The loose file is what makes "stops" mean anything: it is the answer
		  the name-only rung would give, and the one a tie must not fall through
		  to. Without it the walk would end at this rung whether or not the tie
		  was recorded.
		*/
		const files = selection(
			'chair/chair.gltf',
			'chair/a/textures/wood grain.png',
			'chair/b/textures/wood grain.png',
			'chair/wood grain.png'
		)

		expect(
			referenceIn(files, 'textures/wood%20grain.png', 'chair/chair.gltf')
		).toBeUndefined()
	})
})

describe('a reference and a key are compared in one spelling', () => {
	it('matches a Windows separator against a stored path', () => {
		const files = selection('chair/textures/wood.png')

		expect(referenceIn(files, 'textures\\wood.png', 'chair/chair.obj')).toBe(
			'chair/textures/wood.png'
		)
	})

	it('decodes an escape the way a glTF writes one', () => {
		const files = selection('chair/textures/red wood.png')

		expect(
			referenceIn(files, 'textures/red%20wood.png', 'chair/chair.gltf')
		).toBe('chair/textures/red wood.png')
	})

	it('still finds a file whose own name holds a percent escape', () => {
		/*
		  Both spellings are tried, because a file can be named `wood%20.png` on
		  disk and referred to by that name.

		  THE DECOY IS THE CASE. With only the one file this passes whether the
		  spellings are tried stage by stage or ladder by ladder. The loose
		  `red wood.png` is what the decoded spelling answers with, by name
		  alone, so walking a whole ladder per spelling lets that guess win and
		  the literal spelling never reaches the exact stage where the real file
		  is sitting.
		*/
		const files = selection(
			'chair/chair.gltf',
			'chair/textures/red%20wood.png',
			'red wood.png'
		)

		expect(
			referenceIn(files, 'textures/red%20wood.png', 'chair/chair.gltf')
		).toBe('chair/textures/red%20wood.png')
	})

	it('does not take a name holding a bare percent sign down', () => {
		/*
		  `%` followed by anything but two hex digits is a malformed escape and
		  `decodeURIComponent` throws `URIError` on it. A file called
		  `50% roughness.png` is an ordinary file.
		*/
		const files = selection('chair/textures/50% roughness.png')

		expect(() =>
			referenceIn(files, 'textures/50% roughness.png', 'chair/chair.gltf')
		).not.toThrow()
		expect(
			referenceIn(files, 'textures/50% roughness.png', 'chair/chair.gltf')
		).toBe('chair/textures/50% roughness.png')
	})

	it('strips a leading ./ so both spellings match', () => {
		const files = selection('chair/diffuse.png')

		expect(referenceIn(files, './diffuse.png', 'chair/chair.gltf')).toBe(
			'chair/diffuse.png'
		)
	})

	it('normalizes the keys too, and hands back the one it was given', () => {
		/*
		  `selectionKey` lower-cases, so a map built from it is already in one
		  spelling - and this rule now also serves maps built from raw file names
		  and from a server payload, which are not. The caller looks the key
		  back up in its own map, so the spelling it stored has to come back.
		*/
		const files = new Map([['Chair/Body/Diffuse.PNG', 'the bytes']])

		expect(
			referenceKeyIn(files.keys(), 'body/diffuse.png', 'Chair/chair.gltf')
		).toBe('Chair/Body/Diffuse.PNG')
		expect(referenceIn(files, 'body/diffuse.png', 'Chair/chair.gltf')).toBe(
			'the bytes'
		)
	})
})

describe('a model whose own folder is unknown scopes nothing', () => {
	it('still finds a nested sibling', () => {
		/*
		  A bare model name gives a root of `''`, and scoping to that admits only
		  keys with no folder at all - strictly worse than not scoping, because
		  it hides every nested sibling instead of merely failing to prefer one.
		*/
		const files = selection('chair/textures/wood.png')

		expect(referenceIn(files, 'wood.png', 'chair.obj')).toBe(
			'chair/textures/wood.png'
		)
	})

	it('resolves against nothing when no model path is given at all', () => {
		const files = selection('textures/wood.png')

		expect(referenceIn(files, 'textures/wood.png')).toBe('textures/wood.png')
	})
})

describe('a reference is canonicalized before it is compared', () => {
	it('collapses a leading ./ on a selection-root reference', () => {
		/*
		  A MISS HERE IS NOT A MISS, IT IS THE WRONG FILE. The exact rung compared
		  the reference verbatim, so this matched nothing, fell through to the
		  name-only rung and came back with `chair/wood.png` - a different image,
		  inside one folder, reported as success.
		*/
		const files = selection(
			'chair/chair.gltf',
			'chair/textures/wood.png',
			'chair/wood.png'
		)

		expect(
			referenceIn(files, './chair/textures/wood.png', 'chair/chair.gltf')
		).toBe('chair/textures/wood.png')
	})

	it('collapses a .. that doubles back inside the reference', () => {
		const files = selection(
			'chair/chair.gltf',
			'chair/textures/wood.png',
			'chair/wood.png'
		)

		expect(
			referenceIn(
				files,
				'chair/textures/../textures/wood.png',
				'chair/chair.gltf'
			)
		).toBe('chair/textures/wood.png')
	})
})

describe('a tail match is bounded at the folder separator', () => {
	it('does not let redwood.png answer wood.png', () => {
		/*
		  THE REFERENCE IS BARE ON PURPOSE. This case named `textures/wood.png`
		  first, and no mutation could redden it: dropping the `/` from the tail
		  rung leaves `redwood.png` failing to end with `textures/wood.png`
		  either way, so it asserted a non-match that was never in question. A
		  bare name is the only spelling under which the boundary is what decides.
		*/
		const files = selection('chair/chair.obj', 'chair/textures/redwood.png')

		expect(referenceIn(files, 'wood.png', 'chair/chair.obj')).toBeUndefined()
	})

	it('anchors a ../ reference by its tail rather than by its name', () => {
		/*
		  What taking the leading dots off buys. `../textures/wood.png` does not
		  resolve, because the selection has no `chair/textures/`; the tail
		  `textures/wood.png` still anchors it to the one file under a
		  `textures/` folder. Leaving the dots on makes that tail match nothing,
		  and the name-only rung then hands back the shallower `chair/y/wood.png`
		  - the wrong file, reported as success.
		*/
		const files = selection(
			'chair/models/chair.obj',
			'chair/x/textures/wood.png',
			'chair/y/wood.png'
		)

		expect(
			referenceIn(files, '../textures/wood.png', 'chair/models/chair.obj')
		).toBe('chair/x/textures/wood.png')
	})
})
