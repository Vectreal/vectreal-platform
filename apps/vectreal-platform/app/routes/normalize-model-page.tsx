/**
 * Dev-only host for the normalize step, driven by
 * `scripts/normalize-generated-model.ts` in headless Chromium.
 *
 * The script sets the file on the input and reads `window.__normalizeResult`
 * back. Nothing here is meant for a person, which is why the page is a bare
 * input: it exists because Draco and USDZ export need a browser.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import type { NormalizeReport } from '../lib/normalize-model/normalize-model-shared'

export type NormalizePageResult =
	| { ok: true; report: NormalizeReport; glb: string; usdz: string }
	| { ok: false; error: string }

declare global {
	interface Window {
		__normalizeResult?: NormalizePageResult
	}
}

export async function loader() {
	if (!import.meta.env.DEV) {
		throw new Response('Not found', { status: 404 })
	}
	return null
}

/** Base64 without spreading every byte onto the call stack at once. */
function toBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(binary)
}

export default function NormalizeModelPage() {
	const [searchParams] = useSearchParams()
	const longestEdge = Number(searchParams.get('longestEdgeMeters'))
	// A file set before hydration fires a change no handler hears, so the
	// script waits for this mark before it sets one.
	const [hydrated, setHydrated] = useState(false)
	useEffect(() => setHydrated(true), [])

	const run = async (file: File) => {
		try {
			const { normalizeModel } =
				await import('../lib/normalize-model/normalize-model')
			const { report, glb, usdz } = await normalizeModel(
				new Uint8Array(await file.arrayBuffer()),
				{ longestEdgeMeters: longestEdge > 0 ? longestEdge : undefined }
			)
			window.__normalizeResult = {
				ok: true,
				report,
				glb: toBase64(glb),
				usdz: toBase64(usdz)
			}
		} catch (error) {
			window.__normalizeResult = {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			}
		}
	}

	return (
		<main className="p-8">
			<input
				type="file"
				accept=".glb"
				aria-label="Generated model"
				data-normalize-input={hydrated ? 'ready' : 'loading'}
				onChange={(event) => {
					const file = event.target.files?.[0]
					if (file) void run(file)
				}}
			/>
		</main>
	)
}
