import '@shared/components/styles/globals.css'

import { createRoot } from 'react-dom/client'

import { ShareCard } from './share-card'

import type { ShareCard as ShareCardDefinition } from '../../lib/share-cards'

/*
  The page `scripts/bake-share-cards.ts` opens on the dev server: one card, the
  one the script put on `window`, in the site's stylesheet for its fonts and
  dark tokens. Nothing imports this module, so no build carries it.
*/
declare global {
	interface Window {
		__SHARE_CARD__: ShareCardDefinition
	}
}

const root = document.getElementById('root')
if (root) createRoot(root).render(<ShareCard {...window.__SHARE_CARD__} />)
