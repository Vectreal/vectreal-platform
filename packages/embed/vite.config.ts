import { readFileSync } from 'node:fs'
import * as path from 'path'

import { defineConfig, type Plugin } from 'vite'

import {
	declarationImports,
	manifestExternals,
	publishedDeclarations
} from '../../vite.library.mts'

/*
  The SDK names the viewer's commands and events, and nothing else of it. A
  consumer installing @vctrl/viewer for two types would install three and the
  renderer too, so the file that declares them ships inside this package and
  the emitted declarations import it instead. It holds only types, which is
  what lets its source stand as a declaration file.
*/
const VIEWER_PROTOCOL_SOURCE = path.resolve(
	import.meta.dirname,
	'../viewer/src/types/viewer-interactions.ts'
)
const VIEWER_PROTOCOL = 'viewer-protocol'

const shipViewerProtocol: Plugin = {
	name: 'vctrl-embed-viewer-protocol',
	generateBundle() {
		const source = readFileSync(VIEWER_PROTOCOL_SOURCE, 'utf8')
		// Shipped as is, so an import would name a package this one does not
		// declare, and the declaration check never sees an asset.
		const imports = declarationImports(source)
		if (imports.length > 0) {
			this.error(
				`${VIEWER_PROTOCOL_SOURCE} imports ${imports.join(', ')}; it ships inside @vctrl/embed and has to stand alone.`
			)
		}
		this.emitFile({
			type: 'asset',
			fileName: `${VIEWER_PROTOCOL}.d.ts`,
			source
		})
	}
}

export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/embed',
	resolve: { tsconfigPaths: true },
	plugins: [
		shipViewerProtocol,
		publishedDeclarations(import.meta.dirname, {
			// Every source file sits at the root of `src`, so one specifier fits.
			beforeWriteFile: (_filePath, content) => ({
				content: content.replaceAll(
					/(['"])@vctrl\/viewer\1/g,
					`'./${VIEWER_PROTOCOL}'`
				)
			})
		}),
		manifestExternals(import.meta.dirname)
	],

	build: {
		emptyOutDir: true,
		reportCompressedSize: true,
		lib: {
			entry: 'src/index.ts',
			name: '@vctrl/embed',
			fileName: 'index',
			formats: ['es', 'iife']
		},
		rolldownOptions: {
			output: [
				{
					format: 'es',
					entryFileNames: 'index.js'
				},
				{
					/*
					  The classic `<script>` build: it defines the `VectrealEmbed`
					  global and nothing else. It keeps the `.umd.js` name it had
					  when it was UMD because generated snippets on customer pages
					  load it by that unversioned URL (`EMBED_SDK_CDN_URL`).
					*/
					format: 'iife',
					name: 'VectrealEmbed',
					entryFileNames: 'vectreal-embed.umd.js',
					exports: 'named'
				}
			]
		}
	}
})
