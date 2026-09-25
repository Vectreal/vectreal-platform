import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { balancedPreset } from '../../../constants/optimizations'
import { usePrepareGltfDocument } from '../../../hooks/scene-loader/use-scene-document-export'
import { persistPendingSceneDraftOrchestrator } from '../../../lib/domain/scene/client/scene-draft-persistence'
import { sceneViewerSettingsAtom } from '../../../lib/stores/scene-settings-store'
import { runOptimizationPass } from '../../publisher/optimization/run-optimization-pass'
import { resolvePublishedSceneBytes } from '../../publisher/optimization/utils'

import type { OptimizationStepsController } from '../../publisher/optimization/use-optimization-steps'

export type OwnFileOutcome =
	| {
			ok: true
			buffer: ArrayBuffer
			fileName: string
			originalBytes: number
			bytes: number
	  }
	| { ok: false; reason: 'unsupported' | 'failed' }

/** What the stage asks of a visitor's file: prepare it for drawing, then hand it on. */
export interface OwnFileApi {
	prepare: (files: File[]) => Promise<OwnFileOutcome>
	handOff: () => Promise<void>
}

// The publisher's pass reports each step to its checklist; the hero has one status line instead.
const NO_CHECKLIST: OptimizationStepsController = {
	plan: () => {},
	begin: () => {},
	complete: () => {},
	settleAll: () => {},
	reset: () => {}
}

/**
 * A visitor's own file on the hero, through the publisher's own machinery: the
 * same loader, the same Balanced pass and the same hand-off the converter uses,
 * so the numbers on the sheet are the numbers the publisher would show.
 *
 * Its own lazy chunk, loaded on the first drop: the loader and optimizer are
 * several times the size of the stage and nobody who only reads the page needs
 * them.
 */
export default function HeroOwnFile({
	onReady
}: {
	onReady: (api: OwnFileApi) => void
}) {
	const optimizer = useOptimizeModel()
	return (
		<ModelProvider optimizer={optimizer}>
			<Runner onReady={onReady} />
		</ModelProvider>
	)
}

function Runner({ onReady }: { onReady: (api: OwnFileApi) => void }) {
	const { load, optimizer } = useModelContext(true)
	const prepareGltfDocument = usePrepareGltfDocument()
	const currentSettings = useAtomValue(sceneViewerSettingsAtom)
	const navigate = useNavigate()

	// The api is handed out once and outlives renders, so it reads the context through a ref.
	const latest = useRef({
		load,
		optimizer,
		prepareGltfDocument,
		currentSettings,
		navigate
	})
	latest.current = {
		load,
		optimizer,
		prepareGltfDocument,
		currentSettings,
		navigate
	}

	/*
	  What was prepared, as the hand-off must describe it. Not read back from the
	  context: the optimizer renames the file once its pass has run.
	*/
	const prepared = useRef<{
		name: string
		originalBytes: number
		bytes: number
	} | null>(null)

	useEffect(() => {
		onReady({
			async prepare(files) {
				const { load, optimizer } = latest.current
				const loaded = await load({ kind: 'files', files })
				if (loaded.status === 'error') {
					return {
						ok: false,
						reason:
							loaded.error.code === 'unsupported_format'
								? 'unsupported'
								: 'failed'
					}
				}
				if (!loaded.file) return { ok: false, reason: 'failed' }

				const originalBytes =
					loaded.file.sourcePackageBytes ??
					files.reduce((sum, one) => sum + one.size, 0)
				const { dracoReport } = await runOptimizationPass({
					fromOriginal: false,
					optimizations: balancedPreset,
					steps: NO_CHECKLIST,
					model: optimizer,
					baseline: {
						clientSceneBytes: originalBytes,
						clientTextureBytes: loaded.file.sourceTextureBytes ?? null,
						sourcePackageBytes: loaded.file.sourcePackageBytes,
						sourceTextureBytes: loaded.file.sourceTextureBytes,
						statsSceneBytes: null,
						reportTextureBytesBefore: null,
						calculateSceneBytes: async () => null
					},
					setRuntime: () => {}
				})

				// The working document: every pass applied, Draco left for publish time, as in the publisher.
				const working = await optimizer.getModel()
				if (!working) return { ok: false, reason: 'failed' }
				const bytes =
					resolvePublishedSceneBytes(working.byteLength, dracoReport) ??
					working.byteLength
				prepared.current = { name: loaded.file.name, originalBytes, bytes }
				const buffer = working.buffer.slice(
					working.byteOffset,
					working.byteOffset + working.byteLength
				) as ArrayBuffer
				return {
					ok: true,
					buffer,
					fileName: loaded.file.name,
					originalBytes,
					bytes
				}
			},

			// The converter's hand-off: the document as a pending draft, restored by the publisher on arrival.
			async handOff() {
				const { prepareGltfDocument, currentSettings, navigate } =
					latest.current
				const done = prepared.current
				if (!done) return
				try {
					const draftId = await persistPendingSceneDraftOrchestrator({
						modelAvailable: true,
						prepareGltfDocumentForUpload: prepareGltfDocument,
						sceneMetaState: {
							name: done.name.replace(/\.[^/.]+$/, ''),
							description: '',
							thumbnailUrl: ''
						},
						currentSettings,
						// So the publisher opens on Balanced, already applied, at the size the sheet showed.
						optimizationSettings: balancedPreset,
						optimizedSceneBytes: done.bytes,
						clientSceneBytes: done.originalBytes
					})
					if (!draftId) throw new Error('No draft written')
					await navigate(
						`/publisher?restore_draft=1&draft_id=${encodeURIComponent(draftId)}`,
						{ viewTransition: true }
					)
				} catch {
					toast.error('That model could not be handed over. Try the publisher.')
				}
			}
		})
	}, [onReady])

	return null
}
