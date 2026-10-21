import { defineConfig } from 'vite'

import { manifestExternals } from '../../vite.library.mts'

/*
  A Node program, so an SSR build: Node's own modules stay imports rather than
  browser stand-ins. `noExternal` hands the rest to `manifestExternals`, the
  rule every published @vctrl package follows: what package.json declares is
  imported, anything else is bundled.
*/
export default defineConfig({
	root: import.meta.dirname,
	cacheDir: '../../node_modules/.vite/packages/@vctrl/cli',
	resolve: { tsconfigPaths: true },
	plugins: [manifestExternals(import.meta.dirname)],
	ssr: { noExternal: true },
	build: {
		ssr: 'src/main.ts',
		target: 'node22',
		emptyOutDir: true,
		reportCompressedSize: true,
		rolldownOptions: {
			output: {
				entryFileNames: 'main.js',
				chunkFileNames: '[name]-[hash].js',
				// The `vectreal` bin runs this file directly.
				banner: (chunk) => (chunk.isEntry ? '#!/usr/bin/env node' : '')
			}
		}
	}
})
