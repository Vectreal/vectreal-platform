import {
	ModelFile,
	ModelProvider,
	useModelContext
} from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { VectrealViewer } from '@vctrl/viewer'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Vector3 } from 'three'

import { EditorProvider, useEditorContext } from '../../components/providers'
import { sendCustomEvent } from '../../lib/utils/ga-utils'

import DropZone from './drop-zone'
import FileMenu from './file-menu'
import UploadInfoDialog from './upload-info-dialog'

const Editor = () => {
	const { isFileLoading, file, on, off, reset } = useModelContext()
	const { autoRotate, hdr, showGrid, color } = useEditorContext()

	const [hasShownInfo, setHasShownInfo] = useState(
		!!window.sessionStorage.getItem('hasShownInfo')
	)

	function handleReset() {
		reset()
	}

	function handleNotLoadedFiles(files?: File[]) {
		toast.error(`Not loaded files: ${files?.map((f) => f.name).join(', ')}`)
	}

	function handleLoadComplete(data?: ModelFile | null) {
		if (data) {
			toast.success(`Loaded ${data.name}`)
		}
	}

	function handleLoadError(error: unknown) {
		console.error('Load error:', error)
		toast.error(error as string)
	}

	function handleLoadStart() {
		sendCustomEvent({
			category: 'Editor Page',
			action: 'upload',
			label: 'Model Load Start'
		})
	}

	useEffect(() => {
		on('load-reset', handleReset)
		on('not-loaded-files', handleNotLoadedFiles)
		on('load-complete', handleLoadComplete)
		on('load-error', handleLoadError)
		on('load-start', handleLoadStart)

		return () => {
			off('load-reset', handleReset)
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('load-error', handleLoadError)
			off('load-start', handleLoadStart)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function handleClose() {
		setHasShownInfo(true)
		// To avoid showing the dialog again during the session
		window.sessionStorage.setItem('hasShownInfo', 'true')
	}

	return (
		<section className="mx-[-1rem] h-dvh overflow-hidden">
			<UploadInfoDialog open={!hasShownInfo} onClose={handleClose} />

			{!isFileLoading && file ? (
				<VectrealViewer
					model={file?.model}
					key="model-viewer"
					gridOptions={{ showGrid }}
					envOptions={{
						backgroundColor: color,
						env: {
							preset: hdr.preset,
							background: hdr.asBackground,
							backgroundIntensity: hdr.backgroundIntensity,
							environmentIntensity: hdr.exposure,
							backgroundBlurriness: hdr.blurriness
						},
						stage: {
							preset: hdr.stagePreset
						}
					}}
					controlsOptions={{
						autoRotate: autoRotate.enabled,
						autoRotateSpeed: autoRotate.speed,
						dampingFactor: 0.02,
						zoomSpeed: 0.4
					}}
					cameraOptions={{
						initialCameraPosition: new Vector3(0, 5, 5)
					}}
				/>
			) : (
				<DropZone key="drop-zone" />
			)}

			<FileMenu />
		</section>
	)
}

const EditorPage = () => {
	const optimizer = useOptimizeModel()
	return (
		<EditorProvider>
			<ModelProvider optimizer={optimizer}>
				<Editor />
			</ModelProvider>
		</EditorProvider>
	)
}

export default EditorPage
