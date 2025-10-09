import { ModelFile, useModelContext } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { useIsMobile } from '@vctrl-ui/hooks/use-mobile'
import { LoadingSpinner } from '@vctrl-ui/ui/loading-spinner'
import { SpinnerWrapper } from '@vctrl-ui/ui/spinner-wrapper'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { useAtom, useSetAtom } from 'jotai/react'
import { RESET } from 'jotai/utils'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
	controlsAtom,
	environmentAtom,
	metaAtom,
	processAtom,
	shadowsAtom,
	toneMappingAtom
} from '../../lib/stores/publisher-config-store'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import { Route } from './+types/publisher-page'
import { DropZone } from './drop-zone'

export async function loader({ request, params }: Route.LoaderArgs) {
	return {
		isMobile: isMobileRequest(request),
		sceneId: params.sceneId || null
	}
}

const PublisherPage: React.FC<Route.ComponentProps> = ({ loaderData }) => {
	const [loadingStarted, setLoadingStarted] = useState(false)
	const [sceneLoadAttempted, setSceneLoadAttempted] = useState(false)
	const isMobile = useIsMobile(loaderData.isMobile)
	const { isFileLoading, file, on, off, reset, load } = useModelContext()

	// publisher data store
	const [env] = useAtom(environmentAtom)
	const [toneMapping] = useAtom(toneMappingAtom)
	const [controls] = useAtom(controlsAtom)
	const [shadows] = useAtom(shadowsAtom)
	const setMeta = useSetAtom(metaAtom)
	const setProcess = useSetAtom(processAtom)

	// Load scene when sceneId is provided
	useEffect(() => {
		const sceneId = loaderData.sceneId

		// Only load if we have a sceneId and no model is currently loaded and haven't attempted yet
		if (sceneId && !file?.model && !isFileLoading && !sceneLoadAttempted) {
			console.log('Loading scene from sceneId:', sceneId)
			setSceneLoadAttempted(true)

			// Fetch the scene data
			const loadScene = async () => {
				try {
					setLoadingStarted(true)

					const formData = new FormData()
					formData.append('action', 'get-scene-settings')
					formData.append('sceneId', sceneId)

					const response = await fetch('/api/scene-settings', {
						method: 'POST',
						body: formData
					})

					const result = await response.json()

					if (!response.ok || result.error) {
						throw new Error(
							result.error || `HTTP error! status: ${response.status}`
						)
					}

					const data = result.data || result

					// If we have GLTF data and assets, reconstruct and load the model
					if (data.gltfJson && data.assetData) {
						console.log('Reconstructing GLTF model with assets...')

						// Create File objects for all assets
						const assetFiles: File[] = []

						// Convert asset data from server format into File objects
						if (data.assetData && typeof data.assetData === 'object') {
							for (const [, assetInfo] of Object.entries(data.assetData)) {
								const info = assetInfo as {
									data: number[]
									fileName: string
									mimeType: string
								}
								const uint8Array = new Uint8Array(info.data)
								const blob = new Blob([uint8Array], { type: info.mimeType })
								const file = new File([blob], info.fileName, {
									type: info.mimeType
								})

								assetFiles.push(file)
								console.log(`Created File object for ${info.fileName}`)
							}
						}

						// Create GLTF file
						const gltfJsonString = JSON.stringify(data.gltfJson)
						const gltfBlob = new Blob([gltfJsonString], {
							type: 'model/gltf+json'
						})
						const gltfFile = new File(
							[gltfBlob],
							`${data.meta?.sceneName || 'scene'}.gltf`,
							{ type: 'model/gltf+json' }
						)

						// Load the GLTF file along with all asset files
						// The loader expects the GLTF file and its assets together
						await load([gltfFile, ...assetFiles])

						toast.success(`Loaded scene: ${data.meta?.sceneName || sceneId}`)
					}
				} catch (error) {
					console.error('Failed to load scene:', error)
					toast.error(
						`Failed to load scene: ${error instanceof Error ? error.message : 'Unknown error'}`
					)
				} finally {
					setLoadingStarted(false)
				}
			}

			loadScene()
		}
	}, [loaderData.sceneId, file?.model, isFileLoading, load, sceneLoadAttempted])

	// Reset the scene load flag when sceneId changes
	useEffect(() => {
		setSceneLoadAttempted(false)
	}, [loaderData.sceneId])

	function handleNotLoadedFiles(files?: File[]) {
		toast.error(`Not loaded files: ${files?.map((f) => f.name).join(', ')}`)
	}

	function handleLoadComplete(data?: ModelFile | null) {
		if (!data) return

		toast.success(`Loaded ${data.name}`)
		setLoadingStarted(false)

		setMeta((prev) => ({
			...prev,
			sceneName: data.name.split('.').at(0) || ''
		}))

		setProcess((prev) => ({
			...prev,
			step: 'preparing',
			showInfo: true,
			showSidebar: false
		}))
	}

	useEffect(() => {
		if (file?.model) {
			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: false
			}))
		}
	}, [file, setProcess])

	useEffect(() => {
		return () => {
			// Reset the model context when the component unmounts
			reset()
			// Reset the process state when the component unmounts
			setProcess(RESET)
		}
	}, [setProcess, reset])

	function handleLoadError(error: unknown) {
		console.error('Load error:', error)

		// Extract error message properly
		let errorMessage = 'Failed to load model'
		if (error instanceof Error) {
			errorMessage = error.message
		} else if (typeof error === 'string') {
			errorMessage = error
		}

		toast.error(errorMessage)
		setLoadingStarted(false)
	}

	function handleLoadStart() {
		setLoadingStarted(true)
	}

	const handleScreenshot = useCallback((url: string) => {
		// setMeta((prev) => ({
		// 	...prev,
		// 	thumbnailUrl: url
		// }))
	}, [])

	useEffect(() => {
		on('not-loaded-files', handleNotLoadedFiles)
		on('load-complete', handleLoadComplete)
		on('load-error', handleLoadError)
		on('load-start', handleLoadStart)

		return () => {
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('load-error', handleLoadError)
			// off('load-start', handleLoadStart)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="-z-0 grow overflow-clip">
			<Suspense fallback={null}>
				<AnimatePresence>
					{!isFileLoading && file?.model ? (
						<motion.div
							key="model-viewer"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.75, delay: 1 }}
							className="bg-muted/50 flex h-full w-full"
						>
							<VectrealViewer
								className="z-10 after:absolute after:inset-0 after:-z-10 after:w-[50%] after:bg-linear-to-r after:from-black/20 after:to-transparent"
								model={file?.model}
								key="model-viewer"
								infoPopoverOptions={{ showInfo: false }}
								toneMappingOptions={toneMapping}
								envOptions={env}
								controlsOptions={controls}
								shadowsOptions={shadows}
								onScreenshot={handleScreenshot}
							/>
						</motion.div>
					) : isFileLoading || loadingStarted ? (
						<motion.div
							key="loading-spinner"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
							className="flex h-full w-full items-center justify-center"
						>
							<SpinnerWrapper>
								<LoadingSpinner />
							</SpinnerWrapper>
						</motion.div>
					) : (
						<motion.div
							key="drop-zone"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="relative flex h-full w-full items-center justify-center"
						>
							<DropZone key="drop-zone" isMobile={isMobile} />
						</motion.div>
					)}
				</AnimatePresence>
			</Suspense>
		</div>
	)
}

export default PublisherPage
