/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

/**
 * What a reference inside a model means, given where the model sits in the
 * dropped selection.
 *
 * One rule, one file. It had five statements before this: `siblingFor` for the
 * three.js formats, which said it properly, and four maps on the glTF path that
 * each poured every hopeful spelling of every file in and ended with a bare
 * basename key. A map cannot report a tie - one file per name, last write wins -
 * so a folder holding `body/diffuse.png` and `wheels/diffuse.png` textured both
 * materials with the same image and reported success.
 *
 * Nothing here knows what it is resolving *to*. The lookup answers with a key,
 * so the same rule serves a `Map<string, Uint8Array>`, a `Map<string, File>`
 * and a list of `{ fileName, size }` without four copies of itself.
 */

/**
 * The one spelling a name is keyed under, whatever it came from.
 *
 * ANY MAP HANDED TO `referenceIn` MUST BE BUILT WITH THIS. It is not a
 * convenience: it decides which names are the *same* name, so two consumers
 * that key differently hold different maps and answer differently, and a
 * collision resolves at opposite ends of each. That disagreement was found
 * three times - two names differing only in case, two differing only in `\`
 * versus `/`, and a stored name re-decoded once more than the reference - each
 * time as a byte figure describing one file while another rendered. It is one
 * rule with two entry points rather than three call sites agreeing by hand.
 *
 * It folds case and separators and nothing else. In particular it does not
 * percent-decode: a stored asset name is already decoded and a reference is
 * not, and `referenceKeyIn` decodes the reference alone for exactly that
 * reason.
 */
export function resolutionKey(name: string): string {
	return normalizePath(name)
}

/**
 * Where a file sits in the selection, in the one spelling everything uses.
 *
 * The model is keyed the same way as its siblings on purpose: a reference is
 * resolved against the model's own directory, and that only works while the two
 * are expressed in the same terms.
 */
export function selectionKey(file: File): string {
	return resolutionKey(file.webkitRelativePath || file.name)
}

/**
 * The key a reference names, resolved against the dropped selection.
 *
 * A reference inside a model is written relative to *the model*, and the
 * selection is keyed relative to what the visitor dropped - which may be the
 * model's own folder, a folder above it, or nothing at all. `modelPath` is what
 * connects the two frames, and resolving against it is the only stage that can
 * be certain: `map_Kd ../textures/wood.png` beside `chair/models/chair.obj`
 * means `chair/textures/wood.png` and nothing else.
 *
 * The looser stages below it exist because a material library is often written
 * by one tool and tidied by a person, so the path it states need not survive.
 * They are scoped to the model's own root, because a second folder dropped in
 * the same gesture is a different model's belongings - ranking its files
 * against this model's was how one chair ended up wearing another's texture.
 *
 * Ambiguity resolves to nothing rather than to a guess, and it stops the walk:
 * a reference this cannot pin down must not then be answered by a vaguer rule.
 * Two subfolders holding a `diffuse.png` are an ordinary export, and picking
 * either would texture one part with the other's image and report success.
 *
 * What "nothing" then means is the caller's to decide, and the two callers
 * decide differently on purpose. The OBJ path drops the map line and the
 * material keeps its colour, the "correct but grey" the page promises. The
 * glTF path refuses the load and names the file, because a glTF's buffer is
 * referenced the same way its textures are and a model missing that one is not
 * grey, it is absent. Stating either outcome here as *the* outcome reads as a
 * promise this module is in no position to make.
 *
 * THE KEYS ARE NORMALIZED TOO, AND THE ORIGINAL COMES BACK. When this rule
 * served only `siblingsFromFiles` it could lower-case the reference alone,
 * because `selectionKey` had already lower-cased every key. A map built
 * anywhere else has not been, and a caller holding a `Map` needs the spelling
 * it stored rather than the one this compared.
 */
export function referenceKeyIn(
	keys: Iterable<string>,
	reference: string,
	modelPath = ''
): string | undefined {
	/*
	  Separators and case first. An MTL written on Windows refers to
	  `textures\wood.png` while the same file is keyed `textures/wood.png`, and
	  a reference differing only in case is the same file on every platform.
	*/
	const stated = normalizePath(reference)
	if (!stated) return undefined

	const candidates: Array<readonly [string, string]> = []
	for (const key of keys) candidates.push([normalizePath(key), key])

	const model = normalizePath(modelPath)
	/*
	  `null` unless the model's own folder is actually known. A bare name - which
	  is what a loose file dragged in beside a folder has, and what
	  `loadFromBuffer` can only ever pass - gives a root of `''`, and scoping to
	  that admits only keys with no folder at all: strictly worse than not
	  scoping, because it hides every nested sibling instead of merely failing to
	  prefer one. A genuinely flat selection is unaffected either way, since all
	  of its keys are bare names too.
	*/
	const scope = model.includes('/') ? rootOf(model) : null

	/*
	  WHY THE CERTAIN RUNG IS NOT SCOPED, after three attempts to scope it.

	  A reference resolved against the model's own directory is the exporter's
	  own statement about where a file sits, and the only reason to overrule it
	  would be knowing that the folder it lands in belongs to a different model.
	  Nothing here can know that. Three rules tried: any other root is someone
	  else's, which refused the ordinary drag of `model/` and `textures/`
	  together; a root holding an importable file is someone else's, which
	  refused a shared folder because it happened to contain a `preview.gltf` or
	  a decorative `bolt.stl`; and refusing outright rather than falling through,
	  which turned that into a load failure instead of a wrong texture.

	  Every one of those was reachable from an ordinary drop, and the leak they
	  were guarding - a glTF that literally writes `../chairB/wood.png` - is not
	  something an exporter produces. So the certain rung honours what the
	  reference says, and the guessing rungs below stay scoped to the model's own
	  root, which is where a cross-folder answer would otherwise be invented
	  rather than stated.
	*/

	/*
	  A glTF writes its URIs percent-encoded per spec and an MTL does not, so
	  both spellings are tried. Both, because a file can be named
	  `wood%20grain.png` on disk and referred to by that name - which is what the
	  glTF path's twelve-clause cross product was covering, among much else. A
	  reference that cannot be decoded is its own literal spelling and appears
	  once.

	  STAGE BY STAGE, NOT LADDER BY LADDER. Walking the whole ladder for the
	  decoded spelling and only then starting again on the literal one let a
	  *guess* in the first spelling beat a *certainty* in the second: a loose
	  `red wood.png` answered the decoded reference by name alone, so the
	  literal reference never reached the exact stage where
	  `chair/textures/red%20wood.png` was sitting. Certainty is a property of
	  the stage, not of the spelling.
	*/
	const decoded = normalizePath(decodeReference(reference))
	const spellings = decoded === stated ? [decoded] : [decoded, stated]

	return keyFor(candidates, spellings, dirname(model), scope)
}

/**
 * The entry a reference names. Three lines over `referenceKeyIn`, so a caller
 * holding a map does not have to remember to look the key back up.
 */
export function referenceIn<T>(
	entries: ReadonlyMap<string, T>,
	reference: string,
	modelPath = ''
): T | undefined {
	const key = referenceKeyIn(entries.keys(), reference, modelPath)
	return key === undefined ? undefined : entries.get(key)
}

/**
 * The ladder. Four rungs, each asked of every spelling before the next is
 * tried, because certainty is a property of the rung and not of the spelling.
 *
 * Walking a whole ladder per spelling let a guess in one spelling beat a
 * certainty in the other, and interleaving whole *stages* was not enough: the
 * exact stage had two rungs of its own. Every rung now goes through one
 * combiner, which is also where the three rules about what a spelling's answer
 * is worth live, rather than at three different rungs saying it three ways.
 */
function keyFor(
	candidates: ReadonlyArray<readonly [string, string]>,
	spellings: readonly string[],
	directory: string,
	scope: string | null
): string | undefined {
	/*
	  A KEY WITH NO FOLDER IS IN EVERY SCOPE, and ranks last rather than first;
	  see `referenceKeyIn` and `shallowestMatch` for both halves of that.

	  TWO LOOKUPS, AND THE DIFFERENCE IS THE SCOPE. `findKey` answers from the
	  whole selection; `exactly` answers only within the model's own root. Which
	  rung takes which is the whole design: the rung that resolves a reference
	  against the model's own directory uses `findKey`, because it is repeating
	  what the exporter stated, and the rungs that would *invent* a crossing by
	  matching on a tail or a bare name use `exactly`. `referenceKeyIn` has the
	  argument, including the three attempts to scope the certain rung and what
	  each of them broke.

	  An out-of-scope match is treated as no match rather than as a tie, so a
	  scoped rung refusing does not stop the rungs below from answering.
	*/
	const inScope = (key: string) =>
		scope === null || rootOf(key) === scope || rootOf(key) === ''
	const findKey = (path: string) =>
		candidates.find(([normalized]) => normalized === path)?.[1]
	const exactly = (path: string) => (inScope(path) ? findKey(path) : undefined)

	/*
	  ONE RUNG, ASKED OF EVERY SPELLING, ANSWERING ONCE. Three rules meet here,
	  and the first two were learned a round apart:

	  A tie in one spelling does not end the walk by itself. It ends the walk only
	  if no spelling produced a single answer at this rung, or the identical
	  selection would answer or refuse depending on which spelling the reference
	  happened to be written in.

	  Two spellings answering with two different files is itself a tie. Returning
	  the first let the array order decide - `wood%20grain.png` beside both a
	  `wood grain.png` and a literal `wood%20grain.png` is two files each a
	  perfect match under one legitimate reading, which is the same "has not said
	  which it means" the ladder refuses everywhere else.

	  And a spelling with nothing to ask at this rung (`null`) is not an answer of
	  any kind, so it neither settles the rung nor ties it.
	*/
	const rung = (
		ask: (wanted: string) => { key?: string; ambiguous: boolean } | null
	): { key?: string; tied: boolean } => {
		let answer: string | undefined
		let tied = false

		for (const wanted of spellings) {
			const found = ask(wanted)
			if (found === null) continue

			if (found.ambiguous) {
				tied = true
				continue
			}

			if (found.key === undefined) continue
			if (answer === undefined) answer = found.key
			else if (answer !== found.key) return { tied: true }
		}

		return { key: answer, tied }
	}

	/*
	  What the reference means against the model's own directory: the one certain
	  answer, and the only rung that is not scoped. `map_Kd ../textures/wood.png`
	  beside `chair/models/chair.obj` means `chair/textures/wood.png`, and a
	  drop of `model/` and `textures/` together means `textures/wood.png` - one
	  export in two roots, which is what a file manager gives you when you select
	  both. `referenceKeyIn` has the argument at length.
	*/
	const resolved = (wanted: string) => {
		const path = resolveAgainst(directory, wanted)
		return path === null ? null : { key: findKey(path), ambiguous: false }
	}

	/*
	  Then the reference read from the selection root, which is a guess rather
	  than a certainty. It once consulted no scope at all, and that was the first
	  route by which a second dropped folder could answer:
	  `chairA/models/chair.obj` naming `textures/wood.png` took a `textures/`
	  folder dropped beside it in preference to its own `chairA/textures/`,
	  because this rung ran before the stages that were scoped.
	*/
	const stated = (wanted: string) => {
		/*
		  Read from the selection root, and canonicalized first. This compared the
		  reference verbatim, so `./chair/textures/wood.png` matched no key, fell
		  through to the name-only rung and came back with `chair/wood.png` - the
		  wrong file inside a single folder, reported as success. Resolving
		  against nothing collapses `.` and `..` without moving the path.
		*/
		const path = resolveAgainst('', wanted)
		return path === null ? null : { key: exactly(path), ambiguous: false }
	}

	/*
	  The reference as a path tail, within the model's own folder. `/` guards the
	  boundary so `wood.png` cannot be satisfied by `redwood.png`.

	  The reference's own tail, not the resolved path: resolving prepends the
	  model's directory, and a key cannot end with a path that starts at the
	  selection root. Matching on that made the tail rung unreachable for every
	  nested model, so the name-only rung answered everything.
	*/
	const bySuffix = (wanted: string) => {
		const tail = withoutLeadingDots(wanted)
		return shallowestMatch(
			candidates,
			(key) => inScope(key) && key.endsWith(`/${tail}`)
		)
	}

	/*
	  And last the name alone, for a reference whose folders the selection does
	  not have - a flat multi-file pick, or a path from the machine the file was
	  authored on, which no tail of ours can anchor.

	  A reference that is already a bare name skips this rung, and that is an
	  early exit rather than a guard: the only keys it could add are the
	  folderless ones, which `stated` has already offered by exact match.

	  TESTED AGAINST THE REFERENCE AS WRITTEN, NOT ITS TAIL. It read
	  `name === tail`, which is the same thing only while nothing was stripped -
	  and `withoutLeadingDots` strips the climb. So `../scene.bin` skipped this
	  rung on the grounds that `stated` had already offered `scene.bin`, when
	  `stated` had offered nothing at all: `resolveAgainst` refuses to climb past
	  the selection root and returns null. Every rung then declined, and a glTF
	  sitting in `model/` with its `.bin` one folder up - which is what makes an
	  exporter write `../scene.bin` - found none of its files. For an image that
	  is a missing texture; for `buffers[0]` the whole scene fails to parse.
	*/
	const byName = (wanted: string) => {
		const tail = withoutLeadingDots(wanted)
		const name = basename(tail)
		if (name === wanted) return null

		return shallowestMatch(
			candidates,
			(key) => inScope(key) && basename(key) === name
		)
	}

	/*
	  The ladder. Ambiguity resolves to nothing rather than to a guess, and it
	  stops the walk: a reference one rung cannot pin down must not then be
	  answered by a vaguer one.
	*/
	for (const ask of [resolved, stated, bySuffix, byName]) {
		const found = rung(ask)
		if (found.key !== undefined) return found.key
		if (found.tied) return undefined
	}

	return undefined
}

/**
 * The nearest entry a predicate matches, and whether the nearest was a tie.
 *
 * NEAREST, NOT ONLY. Treating any second match as ambiguous dropped textures
 * that resolve perfectly well: a selection carrying both
 * `chair/textures/wood.png` and `chair/lod1/textures/wood.png` has exactly one
 * file `textures/wood.png` can mean, because naming the other one requires
 * saying `lod1/`. Depth expresses that - fewest folders in front wins.
 *
 * The tie is reported rather than folded into "found nothing", because the two
 * are opposite instructions to the caller: nothing found means try a looser
 * rule, and a tie means stop.
 */
function shallowestMatch(
	candidates: ReadonlyArray<readonly [string, string]>,
	matches: (key: string) => boolean
): { key?: string; ambiguous: boolean } {
	let key: string | undefined
	let depth = Infinity
	let ambiguous = false

	for (const [normalized, original] of candidates) {
		if (!matches(normalized)) continue

		/*
		  A KEY WITH NO FOLDER RANKS LAST, NOT FIRST. Depth is "how many folders
		  stand in front of this file", and a file at the top of the selection
		  has none - so counting it as depth 1 made it the shallowest candidate
		  there is, and it beat every correctly-scoped file in the model's own
		  folder. A loose `wood.png` dropped beside a folder then answered a
		  reference that folder's own `textures/wood.png` should have, and broke
		  ties that should have been refused.

		  It is a real candidate: a file at the top of the selection belongs to
		  no folder and may well be what the model means. It is simply the last
		  one to try.
		*/
		const keyDepth = normalized.includes('/')
			? normalized.split('/').length
			: Number.MAX_SAFE_INTEGER

		if (keyDepth < depth) {
			key = original
			depth = keyDepth
			ambiguous = false
		} else if (keyDepth === depth) {
			ambiguous = true
		}
	}

	/*
	  THE FLAG CARRIES THE TIE, NOT A WITHHELD KEY. This returned `{ ambiguous:
	  true }` with no key, which the ladder's combiner never looked at: it tests
	  the flag and moves on before it reads a key. Two ways to say one thing,
	  one of them removable with the suite staying green.
	*/
	return { key, ambiguous }
}

/**
 * A reference applied to the directory it was written in, `..` and all.
 *
 * Without this a `../` reference kept a segment no key can ever end with, so
 * the tail stage could not match at all and everything fell through to the file
 * name alone - which then answered `../textures/wood.png` with a `wood.png`
 * sitting somewhere else entirely.
 */
function resolveAgainst(directory: string, reference: string): string | null {
	const segments = directory ? directory.split('/') : []

	for (const segment of reference.split('/')) {
		if (segment === '.' || segment === '') continue

		if (segment === '..') {
			/*
			  Climbing past the selection means nothing we hold. Popping an empty
			  list instead clamped the path to the root and then walked back
			  down, so `../../../chairB/textures/wood.png` resolved to another
			  dropped folder's file - and this stage is deliberately unscoped, so
			  it reached past the guard the fallbacks below use.
			*/
			if (segments.length === 0) return null
			segments.pop()
		} else {
			segments.push(segment)
		}
	}

	return segments.join('/')
}

/**
 * A percent-encoded reference as the file it names is actually spelled.
 *
 * Returned as it came when it cannot be decoded, for the reason
 * `normalizeAssetUri` gives at length: `decodeURIComponent` throws on any
 * malformed escape, a lone `%` is one, and a file called `50% roughness.png`
 * is an ordinary file rather than a broken model.
 */
function decodeReference(reference: string): string {
	try {
		return decodeURIComponent(reference)
	} catch {
		return reference
	}
}

/** One spelling for a path, whatever platform or picker wrote it. */
function normalizePath(path: string): string {
	return path.toLowerCase().replace(/\\/g, '/')
}

/** The reference with any leading `./` and `../` taken off. */
function withoutLeadingDots(reference: string): string {
	return reference.replace(/^(\.\.?\/)+/, '')
}

/**
 * The dropped item a key belongs to. Empty for a flat selection, where every
 * file is keyed by its name alone and there is no folder to belong to.
 */
function rootOf(path: string): string {
	const cut = path.indexOf('/')
	return cut < 0 ? '' : path.slice(0, cut)
}

function dirname(path: string): string {
	const cut = path.lastIndexOf('/')
	return cut < 0 ? '' : path.slice(0, cut)
}

function basename(path: string): string {
	return path.split('/').pop() ?? path
}
