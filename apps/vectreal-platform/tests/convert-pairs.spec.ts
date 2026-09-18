/**
 * A converter page exists only for a conversion we can actually perform, and it
 * reaches every crawl surface from one manifest.
 *
 * Both halves are ratchets rather than conventions.
 *
 * The capability half is what lets the page work and the pipeline work ship
 * independently. "glb to fbx" is a top query on both incumbent converter sites
 * and three.js has no FBX exporter, so the tempting move - publish the page now,
 * serve it later - is exactly the one that must fail loudly. A page that ranks
 * and then cannot do the thing earns a bounce Google reads correctly.
 *
 * The derivation half is what stops the prerender list, the sitemap and
 * /llms.txt drifting apart from each other, which is how `/pricing` and the
 * static sitemap block already disagree elsewhere in this repo.
 */
import { MODEL_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { describe, expect, it } from 'vitest'

import {
	CONVERTER_SOURCE_FORMATS,
	CONVERTER_TARGET_FORMATS,
	SOURCES_THAT_ARE_BUNDLES,
	bundleSourceCopy,
	convertPairsByTarget,
	sourceAcceptAttribute
} from '../app/lib/convert/convert-capabilities'
import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH,
	CONVERT_PAIRS,
	OPTIONS_BY_TARGET,
	articleFor,
	TARGETS_THAT_INFLATE,
	convertOptionsFor,
	convertPairBySlug,
	convertPairPaths,
	convertPairsBySource
} from '../app/lib/convert/convert-pairs'
import { SITE_URL } from '../app/lib/seo'
import { loader as convertLoader } from '../app/routes/convert-page/convert.$pair'

describe('the pair manifest only describes conversions we can perform', () => {
	it('sources every pair from a format a converter page can accept', () => {
		for (const pair of CONVERT_PAIRS) {
			expect(
				CONVERTER_SOURCE_FORMATS as readonly string[],
				`${pair.slug} reads from ${pair.from}, which no converter page can accept`
			).toContain(pair.from)
		}
	})

	it('targets every pair at a format we can write', () => {
		for (const pair of CONVERT_PAIRS) {
			expect(
				CONVERTER_TARGET_FORMATS as readonly string[],
				`${pair.slug} writes ${pair.to}, which nothing in the pipeline exports`
			).toContain(pair.to)
		}
	})

	it('never offers FBX as a target, because three.js cannot write one', () => {
		expect(CONVERTER_TARGET_FORMATS as readonly string[]).not.toContain('fbx')
		expect(CONVERT_PAIRS.map((pair) => pair.to)).not.toContain('fbx')
	})

	it('names every pair after its own endpoints', () => {
		for (const pair of CONVERT_PAIRS) {
			expect(pair.slug).toBe(`${pair.from}-to-${pair.to}`)
			expect(pair.from).not.toBe(pair.to)
		}
	})

	it('gives every pair a distinct slug', () => {
		const slugs = CONVERT_PAIRS.map((pair) => pair.slug)
		expect(new Set(slugs).size).toBe(slugs.length)
	})

	it('ships at least one pair, so the assertions above are not vacuous', () => {
		expect(CONVERT_PAIRS.length).toBeGreaterThan(0)
	})

	/*
	  A 13 MB GLB came back as a 40 MB USDZ with nothing on the page to explain
	  it, because USDZ stores textures uncompressed. A download several times the
	  size of the upload reads as a broken conversion, and the reader has no way
	  to tell that it is not.

	  The rule is stated over the target format rather than over the one slug, so
	  a second USDZ pair inherits it instead of shipping the same silence again.
	*/
	it('warns on every pair whose target inflates the file', () => {
		for (const pair of CONVERT_PAIRS) {
			if (!(TARGETS_THAT_INFLATE as readonly string[]).includes(pair.to)) {
				continue
			}

			expect(
				pair.note,
				`${pair.slug} writes ${pair.to}, which inflates, and says nothing about it`
			).toBeTruthy()
		}
	})

	/*
	  The note renders beside the before-and-after, so it is only ever read once
	  a conversion has happened. Telling somebody what to bring is therefore
	  telling them after it could have helped - and this has gone wrong twice:
	  first with a size warning on an empty stage, then with three OBJ notes
	  opening "Bring the .mtl and the texture images along with the .obj", which
	  `BUNDLE_SOURCE_COPY` was already saying at the moment it was actionable.
	*/
	it('never turns a result note into a drop instruction', () => {
		/*
		  Every sentence, not just the first word of the note. Two notes are
		  already multi-sentence, so an anchored match would have let the exact
		  regression back in as a second sentence - and "You will need to bring
		  the .mtl" is the same instruction with a run-up.
		*/
		const imperative =
			/\b(bring|drop in|add|include|upload|select|choose)\b\s+(the|a|an|your|its)\b/i

		for (const pair of CONVERT_PAIRS) {
			if (!pair.note) continue

			for (const sentence of pair.note.split(/(?<=\.)\s+/)) {
				expect(
					imperative.test(sentence),
					`${pair.slug} tells the reader what to bring, after they have converted: "${sentence}"`
				).toBe(false)
			}
		}
	})

	it('keeps at least one inflating target, so that rule is not vacuous', () => {
		expect(
			CONVERT_PAIRS.filter((pair) =>
				(TARGETS_THAT_INFLATE as readonly string[]).includes(pair.to)
			).length
		).toBeGreaterThan(0)
	})
})

/*
  The manifest is the capability matrix, in both directions.

  The block above is soundness: no page for a conversion we cannot perform. This
  is completeness: no conversion we can perform without a page. Together they
  mean the set of URLs and the set of things the pipeline can do are the same
  set, which is the property that makes a format selector a navigation control
  rather than a place to discover dead ends - every combination it could offer
  resolves to a real page.

  It is also what makes the pipeline work self-announcing. Adding `stl` to
  `CONVERTER_SOURCE_FORMATS` turns this red until `stl-to-glb`, `stl-to-gltf`
  and `stl-to-usdz` exist, so the pages cannot lag the loader by a release.

  Note what this does NOT say: that every format pairs with every other. The
  matrix has a permanent hole - three.js reads FBX and cannot write one - so
  "every combination" means every combination of these two sets, not the cross
  product of all formats. A selector built on the latter would offer
  conversions that cannot exist. The FBX half is asserted above.
*/
describe('every conversion we can perform has a page', () => {
	function possiblePairSlugs(): string[] {
		const slugs: string[] = []

		for (const from of CONVERTER_SOURCE_FORMATS) {
			for (const to of CONVERTER_TARGET_FORMATS) {
				// A format is not a conversion of itself.
				if (from === to) continue
				slugs.push(`${from}-to-${to}`)
			}
		}

		return slugs
	}

	it('ships a page for every source and target we can pair', () => {
		const shipped = CONVERT_PAIRS.map((pair) => pair.slug)

		for (const slug of possiblePairSlugs()) {
			expect(
				shipped,
				`${slug} is a conversion the pipeline can perform and no page answers it`
			).toContain(slug)
		}
	})

	it('ships no page beyond that matrix', () => {
		const possible = possiblePairSlugs()

		for (const pair of CONVERT_PAIRS) {
			expect(
				possible,
				`${pair.slug} is not in the capability matrix`
			).toContain(pair.slug)
		}
	})
})

/*
  The passes are options on a conversion, not conversions of their own, so they
  need the same shape of guard the pairs have: an option may only be offered
  where it reaches the bytes that get downloaded.

  The one that matters is USDZ. It is written from the three.js scene by
  `exportThreeJSUSDZ`, not from the glTF-Transform document Draco and the texture
  pass operate on, so either option would run, report success, and change nothing
  in the file. That is worse than an absent option, and it is invisible from the
  UI - which is why it is asserted here rather than left to a code review.
*/
describe('a pass is only offered where it changes the download', () => {
	it('offers nothing on a target exported outside the document', () => {
		expect(OPTIONS_BY_TARGET.usdz).toEqual([])

		for (const pair of CONVERT_PAIRS) {
			if (pair.to !== 'usdz') continue
			expect(
				convertOptionsFor(pair),
				`${pair.slug} offers a pass that cannot reach a USDZ`
			).toEqual([])
		}
	})

	/*
	  This asserted `toBe('glb')` and was wrong, which is the more useful half of
	  it: the rule it encoded came from the exporter having only an
	  `exportDocumentGLBDraco`, not from anything about Draco, and a green test
	  then kept the mistake in place. `KHR_draco_mesh_compression` is a document
	  extension and serializes into either container.

	  Stated over the pipeline the target leaves through, so it stays true when a
	  format lands rather than needing to be revisited.
	*/
	it('offers Draco exactly to the targets written from the document', () => {
		for (const [target, options] of Object.entries(OPTIONS_BY_TARGET)) {
			const isGltfFamily = target === 'glb' || target === 'gltf'

			expect(
				options.includes('draco'),
				`${target} ${isGltfFamily ? 'is written from the glTF document and can carry Draco' : 'is not written from the glTF document, so Draco would not reach its bytes'}`
			).toBe(isGltfFamily)
		}
	})

	/*
	  The index explains each target format once instead of repeating a sentence
	  per row, so a format that reaches the matrix without copy renders a heading
	  over an empty line. This is the same ratchet shape as the pairs themselves:
	  the set that must be covered is derived, so adding a format turns it red
	  rather than shipping a blank.
	*/
	it('gives every format a converter can write its one line', () => {
		for (const group of convertPairsByTarget()) {
			expect(
				group.reason,
				`${group.to} can be written but the index has nothing to say about it`
			).toBeTruthy()
		}
	})

	it('lists exactly the formats the converters actually write', () => {
		expect(
			convertPairsByTarget()
				.map((group) => group.to)
				.sort()
		).toEqual([...new Set(CONVERT_PAIRS.map((pair) => pair.to))].sort())
	})

	/*
	  The reading order is a decision, not an accident of declaration order. It
	  was the latter once: the index led with glTF and put GLB last because
	  `glb-to-gltf` is the first row in the manifest.
	*/
	it('leads with GLB, then glTF, then USDZ', () => {
		/*
		  The order written out, because the assertion this replaced derived both
		  sides from `CONVERTER_TARGET_FORMATS` and so could not fail. It did not
		  fail when the order was in fact silently inverted: deriving the reading
		  order from the format owner's declaration order put glTF first, since
		  the owner leads with `gltf` for an unrelated reason (dispatch
		  precedence, so a dropped folder is read as a bundle). GLB leads here
		  because it is what most people arriving actually want.
		*/
		expect(convertPairsByTarget().map((group) => group.to)).toEqual([
			'glb',
			'gltf',
			'usdz'
		])
	})

	/*
	  The index renders one section per destination, so a pair missing from the
	  grouping is a page with no way in from the family's front door. Asserted
	  against `CONVERT_PAIRS` rather than a count, which would survive a pair
	  landing in the wrong group.
	*/
	it('places every pair under the format it produces', () => {
		const placed = convertPairsByTarget().flatMap((group) =>
			group.pairs.map((pair) => ({ slug: pair.slug, under: group.to }))
		)

		expect(placed.map((one) => one.slug).sort()).toEqual(
			CONVERT_PAIRS.map((pair) => pair.slug).sort()
		)

		for (const { slug, under } of placed) {
			const pair = CONVERT_PAIRS.find((one) => one.slug === slug)
			expect(under, `${slug} is grouped under ${under}`).toBe(pair?.to)
		}
	})

	it('carries a pass rule for exactly the formats the loader knows', () => {
		/*
		  This used to assert that `obj`, `stl` and `fbx` carried no passes, which
		  it could only do because `ConvertFormat` was a union of our own, wider
		  than anything the loader had. It is the owner's union now, so a format
		  with no pipeline cannot be named here at all - and `Record` makes an
		  added one a compile error rather than a silent `undefined` on the first
		  page that reads it.

		  Kept as a runtime assertion as well as a type, because vitest does not
		  typecheck: a key deleted here is caught by `nx typecheck`, and this is
		  what catches it in the suite people actually watch.
		*/
		expect(Object.keys(OPTIONS_BY_TARGET).sort()).toEqual(
			[...MODEL_FORMAT_IDS].sort()
		)
	})

	it('offers at least one pass somewhere, so the rules above are not vacuous', () => {
		expect(
			CONVERT_PAIRS.filter((pair) => convertOptionsFor(pair).length > 0).length
		).toBeGreaterThan(0)
	})
})

/*
  The picker on a pair page names one format, and it has to be the page's own.
  It was `{ 'model/gltf-binary': ['.' + pair.from] }` for every source, which
  read as true only while every source was GLB - on an STL page it claims the
  file it wants is a binary glTF.
*/
describe('a pair page offers the picker its own format', () => {
	it.each([
		['glb', 'model/gltf-binary,.glb'],
		['stl', 'model/stl,.stl']
	] as const)('accepts %s by its own media type', (from, expected) => {
		expect(sourceAcceptAttribute(from)).toBe(expected)
	})

	it('never names a media type belonging to another format', () => {
		for (const from of CONVERTER_SOURCE_FORMATS) {
			const offered = sourceAcceptAttribute(from).split(',')

			for (const id of MODEL_FORMAT_IDS) {
				if (id === from) continue
				for (const mimeType of modelFormat(id).mimeTypes) {
					expect(
						offered,
						`the ${from} page offers ${mimeType}, which is ${id}`
					).not.toContain(mimeType)
				}
			}
		}
	})
})

/*
  "Drop a STL file here" is what the page said the day STL landed, because the
  sentence is built from the label and every label before it happened to take
  "a". The two spellings that disagree are both here on purpose: S is a
  consonant read with a vowel sound, and U is a vowel read with a consonant one,
  so a rule written against the letter rather than its name gets USDZ wrong -
  and USDZ is already on the site.
*/
describe('the page says a or an the way the label is read', () => {
	it.each([
		['GLB', 'a'],
		['glTF', 'a'],
		['USDZ', 'a'],
		['STL', 'an'],
		['OBJ', 'an'],
		['FBX', 'an']
	])('writes "%s" as "%s"', (label, article) => {
		expect(articleFor(label)).toBe(article)
	})

	it('reads the labels the pages actually ship', () => {
		/*
		  The table above is a pure-function test over labels, two of which no page
		  carries yet. This is the half that binds it to the site: every shipped
		  source label, with the article its sentences should use. The first
		  version asserted the result was one of 'a' or 'an', which the function
		  returns for every input including the empty string - it would have
		  stayed green with the ternary inverted, which is the defect itself.
		*/
		/*
		  Source labels only, because `articleFor` is only ever called on
		  `pair.fromLabel` - three times in `converter-surface.tsx`. USDZ is the
		  trap the rule exists for and is absent here for a reason that is not an
		  oversight: it is barred as a source, so no sentence on the site takes
		  an article before it. The pure-function table above is where it is
		  covered, and that is the right place for it.
		*/
		const ON_THE_SITE: Record<string, 'a' | 'an'> = {
			GLB: 'a',
			glTF: 'a',
			STL: 'an',
			FBX: 'an',
			OBJ: 'an'
		}

		const shipped = [...new Set(CONVERT_PAIRS.map((pair) => pair.fromLabel))]

		/*
		  Coverage first, so a source format that ships a new label fails here
		  rather than silently inheriting whichever branch a conditional put it
		  in. This replaced `label === 'STL' ? 'an' : 'a'`, which was already
		  wrong for the next format to land: FBX also takes "an".
		*/
		expect(shipped.sort()).toEqual(Object.keys(ON_THE_SITE).sort())

		for (const [label, article] of Object.entries(ON_THE_SITE)) {
			expect(articleFor(label), `"${label}"`).toBe(article)
		}
	})
})

describe('a source that is a bundle is declared as one', () => {
	/*
	  A `.gltf` is JSON pointing at a `.bin` and its images. Getting this wrong is
	  not cosmetic: the drop zone narrows its accept pattern and drops the second
	  input, so the siblings never reach `loadGltfModel` and the visitor is told
	  "Missing required image files" for a folder they selected correctly.
	*/
	it('marks glTF as a bundle and GLB as not', () => {
		expect(SOURCES_THAT_ARE_BUNDLES as readonly string[]).toContain('gltf')
		expect(SOURCES_THAT_ARE_BUNDLES as readonly string[]).not.toContain('glb')
	})

	it('only marks formats a converter page actually reads', () => {
		for (const format of SOURCES_THAT_ARE_BUNDLES) {
			expect(
				CONVERTER_SOURCE_FORMATS as readonly string[],
				`${format} is declared a bundle but no page reads it`
			).toContain(format)
		}
	})
})

describe('the rail can reach every pair', () => {
	it('groups every pair exactly once', () => {
		const grouped = convertPairsBySource().flatMap((group) => group.pairs)

		expect(grouped.map((pair) => pair.slug).sort()).toEqual(
			CONVERT_PAIRS.map((pair) => pair.slug).sort()
		)
	})

	it('makes one group per source format, not one per pair', () => {
		/*
		  Written out, because the assertions below restate `convertPairsBySource`'s
		  own lookup predicate and hold for any grouping at all. Drop the
		  de-duplication in that function and the rail renders seven single-pair
		  groups - "Convert GLB to" three times over - while every other assertion
		  here stays green.
		*/
		expect(convertPairsBySource().map((group) => group.from)).toEqual([
			'glb',
			'gltf',
			'stl',
			'fbx',
			'obj'
		])
	})

	const EXPECTED_SOURCE_LABELS: Readonly<Record<string, string>> = {
		glb: 'GLB',
		gltf: 'glTF',
		stl: 'STL',
		fbx: 'FBX',
		obj: 'OBJ'
	}

	it('puts every pair of a source in that source group, and only those', () => {
		/*
		  Against the manifest rather than against the group's own `from`.
		  `expect(pair.from).toBe(group.from)` was the obvious assertion here and
		  it restates the function's own lookup predicate: a pair lands in a
		  group because its `from` matched, so it holds for any grouping the
		  function could produce, including no grouping at all.
		*/
		for (const group of convertPairsBySource()) {
			expect(
				group.pairs.map((pair) => pair.slug),
				`the ${group.from} group is not the ${group.from} pairs`
			).toEqual(
				CONVERT_PAIRS.filter((pair) => pair.from === group.from).map(
					(pair) => pair.slug
				)
			)

			/*
			  Written out. Deriving the expected label from the manifest the same
			  way the function does makes both sides one source, and every pair
			  of a source shares its label - so any label-picking that still
			  reads a pair of that source stays green.
			*/
			expect(group.fromLabel).toBe(EXPECTED_SOURCE_LABELS[group.from])
		}
	})
})

describe('the route answers only for a pair that exists', () => {
	function runLoader(pair: string) {
		return convertLoader({
			params: { pair },
			request: new Request(`https://vectreal.com/convert/${pair}`),
			context: {} as never
		} as never)
	}

	it('resolves a known pair', () => {
		const known = CONVERT_PAIRS[0].slug
		expect(convertPairBySlug(known)?.slug).toBe(known)
		expect(() => runLoader(known)).not.toThrow()
	})

	it('throws a 404 Response for an unknown pair', () => {
		try {
			runLoader('not-a-pair')
			expect.unreachable('the loader should have thrown')
		} catch (thrown) {
			expect(thrown).toBeInstanceOf(Response)
			expect((thrown as Response).status).toBe(404)
		}
	})

	it('throws a 404 for a pair we deliberately do not serve', () => {
		expect(convertPairBySlug('glb-to-fbx')).toBeNull()
	})
})

describe('every crawl surface derives its pairs from the manifest', () => {
	it('puts every pair in the prerender list', async () => {
		const config = (await import('../react-router.config')).default
		for (const path of convertPairPaths()) {
			expect(config.prerender as string[]).toContain(path)
		}
	})

	/*
	  The index separately, because it is the one page the footer links and so
	  the only entry a crawler is handed. Losing it would orphan the family again
	  while every per-pair assertion above stayed green.
	*/
	it('puts the index in the prerender list', async () => {
		const config = (await import('../react-router.config')).default
		expect(config.prerender as string[]).toContain(CONVERT_INDEX_PATH)
	})

	it('puts every pair in the sitemap', async () => {
		// The loader takes no arguments: it resolves its own origin, because one
		// image is built per commit and deployed to both Fly apps.
		const { loader } = await import('../app/routes/sitemap[.]xml')
		const xml = await ((await loader()) as Response).text()

		for (const path of [CONVERT_INDEX_PATH, ...convertPairPaths()]) {
			expect(xml).toContain(`<loc>${SITE_URL}${path}</loc>`)
		}
	})

	it('puts every pair in llms.txt', async () => {
		const { loader } = await import('../app/routes/llms[.]txt')
		const response = (await loader({
			request: new Request('https://vectreal.com/llms.txt'),
			params: {},
			context: {} as never
		} as never)) as Response
		const body = await response.text()

		expect(body).toContain('## Converters')
		expect(body).toContain(`[${CONVERT_INDEX_COPY.title}]`)
		for (const pair of CONVERT_PAIRS) {
			expect(body).toContain(`/convert/${pair.slug}`)
		}
	})
})

/*
  Every sentence a bundle page shows was written when glTF was the only bundle,
  so each one named `.gltf` and `.bin` outright. The day OBJ became the second,
  all three appeared on the three OBJ pages telling people to bring files for a
  format they had not opened.
*/
describe('a bundle page describes its own format', () => {
	it('has copy for every source that needs siblings', () => {
		for (const from of SOURCES_THAT_ARE_BUNDLES) {
			expect(
				bundleSourceCopy(from),
				`${from} is a bundle and its page has nothing to tell anyone to bring`
			).not.toBeNull()
		}
	})

	it('offers no copy to a source that is a single file', () => {
		for (const from of CONVERTER_SOURCE_FORMATS) {
			if ((SOURCES_THAT_ARE_BUNDLES as readonly string[]).includes(from)) {
				continue
			}

			expect(
				bundleSourceCopy(from),
				`${from} is one file and its page asks for siblings`
			).toBeNull()
		}
	})

	it('never names another format extension in its instructions', () => {
		for (const from of SOURCES_THAT_ARE_BUNDLES) {
			const copy = bundleSourceCopy(from)
			if (!copy) continue

			const sentences = [
				copy.dropTarget,
				copy.instruction,
				copy.chooseLabel,
				copy.refusal
			].join(' ')

			for (const id of MODEL_FORMAT_IDS) {
				if (id === from) continue

				/*
				  The name as a whole word, not the dotted extension. Checking
				  `.gltf` alone let "a glTF folder" through on the OBJ page -
				  which is the exact sentence this test was written for. A word
				  boundary is what keeps "object" from reading as OBJ.
				*/
				expect(
					sentences,
					`the ${from} page tells people about ${id}`
				).not.toMatch(new RegExp(`\\b${modelFormat(id).extension}\\b`, 'i'))
			}
		}
	})

	it('names its own siblings rather than a list nobody would write', () => {
		/*
		  The one thing the sentence exists to say. Derived prose would read
		  "its .mtl, .jpeg, .jpg, .png and .webp", so these are hand-written -
		  and a hand-written sentence that forgets the material library is the
		  failure this catches.
		*/
		expect(bundleSourceCopy('obj')?.instruction).toContain('.mtl')
		expect(bundleSourceCopy('gltf')?.instruction).toContain('.bin')
	})
})
