import { createContext } from 'react'

import type { ViewerKeys } from './scene/viewer-keys'

/**
 * The keys the viewer takes right now, overrides included, for chrome a host
 * puts inside it: help it draws then says what actually works.
 */
export const ViewerKeysContext = createContext<ViewerKeys | null>(null)
