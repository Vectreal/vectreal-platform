/**
 * What the converter reports about a file someone brought to a pair page.
 *
 * The properties are the whole value of the event, so they are tested here and
 * the wiring is verified by firing it in a browser: this module is pure, and a
 * test that renders the surface to prove one `capture` call would be a test of
 * React.
 */
import { describe, expect, it } from 'vitest'

import {
	buildConvertModelReceivedProps,
	buildConvertModelResultProps
} from './convert-events'

const FBX_TO_GLB = { slug: 'fbx-to-glb', from: 'fbx', to: 'glb' } as const

function named(...names: string[]): File[] {
	return names.map((name) => new File(['x'], name))
}

describe('a converter arrival is reported with the page it arrived on', () => {
	it('names the pair, not the file', () => {
		const props = buildConvertModelReceivedProps(
			FBX_TO_GLB,
			named('part.fbx'),
			'loaded'
		)

		expect(props.pair).toBe('fbx-to-glb')
		expect(props.from).toBe('fbx')
		expect(props.to).toBe('glb')
	})

	/*
	  The reason the event exists. Someone on `fbx-to-glb` dropping a `.3ds` is
	  a request for a format that has no page, no loader and no other way of
	  reaching us - so the extension has to survive into the property exactly as
	  they brought it. Resolving it against the formats we accept would report
	  the interesting files as `unknown`.
	*/
	it('reports a format nothing here can read', () => {
		const props = buildConvertModelReceivedProps(
			FBX_TO_GLB,
			named('chair.3ds'),
			'refused'
		)

		expect(props.file_format).toBe('3ds')
		expect(props.outcome).toBe('refused')
		expect(props.format_mismatch).toBe(true)
	})

	it('reads no mismatch when the file is the format the page is for', () => {
		const props = buildConvertModelReceivedProps(
			FBX_TO_GLB,
			named('part.FBX'),
			'loaded'
		)

		/* Lower-cased, or every upper-case extension reads as a mismatch. */
		expect(props.file_format).toBe('fbx')
		expect(props.format_mismatch).toBe(false)
	})

	it('reports a file with no extension as unknown', () => {
		/*
		  Not as the file name. `split('.').pop()` on a dotless name returns the
		  whole name, which is how a file called `model` would arrive in the
		  property list as its own format - and, worse, how a name someone typed
		  reaches an analytics service.
		*/
		const props = buildConvertModelReceivedProps(
			FBX_TO_GLB,
			named('model'),
			'refused'
		)

		expect(props.file_format).toBe('unknown')
	})

	it('counts the files a bundle arrived as', () => {
		const props = buildConvertModelReceivedProps(
			{ slug: 'obj-to-glb', from: 'obj', to: 'glb' },
			named('part.obj', 'part.mtl', 'wood.png'),
			'loaded'
		)

		expect(props.file_count).toBe(3)
		expect(props.file_format).toBe('obj')
		expect(props.format_mismatch).toBe(false)
	})

	it('carries no file name, and nothing else the visitor typed', () => {
		/*
		  A file name is the visitor's own text and this event leaves the
		  machine. The extension is the measurement; the name is not, and it is
		  the kind of property that ends up in a URL, a log line and a session
		  replay without anyone deciding it should.
		*/
		const props = buildConvertModelReceivedProps(
			FBX_TO_GLB,
			named('quarterly numbers FINAL v2.fbx'),
			'loaded'
		)

		expect(Object.values(props).join(' ')).not.toContain('quarterly')
	})
})

/*
  Which file in a selection the event is about. A bundle arrives as a directory
  listing, so the first file is an ordering accident rather than the subject.
*/
describe('the reported format is the model, not whatever came first', () => {
	const file = (name: string) => new File(['x'], name)

	it('reads the model out of a folder that arrived assets-first', () => {
		/*
		  The extra `readme.txt` is what makes this a test of the model lookup.
		  Without it every file before the model is a declared sibling, so the
		  fallback lands on the model too and deleting the lookup entirely leaves
		  this green.
		*/
		const props = buildConvertModelReceivedProps(
			{ slug: 'gltf-to-glb', from: 'gltf', to: 'glb' },
			[
				file('scene.bin'),
				file('readme.txt'),
				file('texture.png'),
				file('scene.gltf')
			],
			'loaded'
		)

		expect(props.file_format).toBe('gltf')
		expect(props.format_mismatch).toBe(false)
	})

	it('ignores a folder artifact that no one dropped on purpose', () => {
		/*
		  A folder picked on macOS carries `.DS_Store`, and it needs nothing else
		  to be wrong to win the fallback - which would report `ds_store` for
		  exactly the arrival this event exists to catch.
		*/
		const props = buildConvertModelReceivedProps(
			{ slug: 'fbx-to-glb', from: 'fbx', to: 'glb' },
			[file('.DS_Store'), file('chair.3ds')],
			'refused'
		)

		expect(props.file_format).toBe('3ds')
	})

	it('reads the OBJ out of a folder led by its material library', () => {
		const props = buildConvertModelReceivedProps(
			{ slug: 'obj-to-glb', from: 'obj', to: 'glb' },
			[
				file('chair.mtl'),
				file('notes.txt'),
				file('wood.png'),
				file('chair.obj')
			],
			'loaded'
		)

		expect(props.file_format).toBe('obj')
		expect(props.format_mismatch).toBe(false)
	})

	it('still reports a format we cannot read, which is the interesting half', () => {
		const props = buildConvertModelReceivedProps(
			{ slug: 'fbx-to-glb', from: 'fbx', to: 'glb' },
			[file('chair.3ds')],
			'refused'
		)

		expect(props.file_format).toBe('3ds')
		expect(props.format_mismatch).toBe(true)
	})

	it('reports an unreadable model rather than the textures beside it', () => {
		const props = buildConvertModelReceivedProps(
			{ slug: 'fbx-to-glb', from: 'fbx', to: 'glb' },
			[file('wood.png'), file('chair.3ds')],
			'refused'
		)

		expect(props.file_format).toBe('3ds')
	})

	it('reports it past a texture format the owner never declared', () => {
		/*
		  A game-asset folder is the FBX segment, and it arrives full of formats
		  no list here would have had. The browser types them, so they do not
		  need listing.
		*/
		const tga = new File(['x'], 'albedo.tga', { type: 'image/x-tga' })

		const props = buildConvertModelReceivedProps(
			{ slug: 'fbx-to-glb', from: 'fbx', to: 'glb' },
			[tga, file('robot.3ds')],
			'refused'
		)

		expect(props.file_format).toBe('3ds')
	})
})

describe('a conversion result is reported with what it achieved', () => {
	const pair = { slug: 'glb-to-gltf', from: 'glb', to: 'gltf' } as const

	it('carries the sizes and their ratio', () => {
		expect(
			buildConvertModelResultProps(pair, [], 4_000_000, 1_000_000)
		).toMatchObject({
			pair: 'glb-to-gltf',
			source_bytes: 4_000_000,
			result_bytes: 1_000_000,
			size_ratio: 0.25
		})
	})

	it('sorts the options, so the same ticks read as the same set', () => {
		expect(
			buildConvertModelResultProps(pair, ['webp', 'draco'], 1, 1).options
		).toEqual(['draco', 'webp'])
	})

	it('reports no ratio when the source size is unknown', () => {
		expect(
			buildConvertModelResultProps(pair, [], null, 1_000).size_ratio
		).toBeNull()
	})
})
