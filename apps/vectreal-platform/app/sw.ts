/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

// This file is bundled and stamped by `scripts/build-sw.mjs` (esbuild +
// workbox-build injectManifest), never by the React Router build. Excluded from
// the app tsconfig so its worker-global types don't collide with the DOM libs.

declare const self: ServiceWorkerGlobalScope & typeof globalThis
// Replaced at bundle time with the current build id so the worker's bytes change
// on every deploy. That byte change is what makes the browser detect an update
// and surface the "reload" prompt, without precaching any JS/CSS to do it.
declare const __SW_BUILD_ID__: string

// Icons/fonts only. `self.__WB_MANIFEST` is the required injection point and is
// filled with the glob from build-sw.mjs (**/*.{woff2,ico,png,svg}). No HTML,
// no JS/CSS, no `.data`, no `/api/*`, no `/auth/session`: navigations and
// per-user responses are never intercepted, so the no-store cache policy holds.
precacheAndRoute(self.__WB_MANIFEST)

// Top-level side effect so the build id survives tree-shaking and lands in the
// emitted worker. Also handy for debugging which build a client is running.
console.info(`[sw] vectreal build ${__SW_BUILD_ID__}`)

// The update banner's "Reload" button posts SKIP_WAITING to the waiting worker
// (via workbox-window's messageSkipWaiting). Activate on that message only, never
// automatically, so an update never disrupts an in-progress session.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting()
	}
})
