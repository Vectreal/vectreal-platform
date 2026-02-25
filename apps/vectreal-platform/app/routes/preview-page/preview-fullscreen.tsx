import {
	ModelFile,
	SceneLoadResult,
	useLoadModel
} from '@vctrl/hooks/use-load-model'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger,
	InfoPopoverVectrealFooter
} from '@vctrl/viewer'
import { memo, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Route } from './+types/preview-fullscreen'
import CenteredSpinner from '../../components/centered-spinner'
import { ClientVectrealViewer } from '../../components/viewer/client-vectreal-viewer'

interface PreviewModelProps {
	file: ModelFile | null
	sceneData?: SceneLoadResult
}

const PreviewInfoPopover = () => (
	<InfoPopover>
		<InfoPopoverTrigger />
		<InfoPopoverContent>
			<InfoPopoverCloseButton />
			<InfoPopoverText>
				<p>
					This is a preview of your scene as it will appear when published. Test
					on various devices and network conditions for the best experience.
				</p>
			</InfoPopoverText>
			<InfoPopoverVectrealFooter />
		</InfoPopoverContent>
	</InfoPopover>
)

const PreviewModel = memo(({ file, sceneData }: PreviewModelProps) => {
	return (
		<div className="h-screen w-full">
			<ClientVectrealViewer
				className="h-full w-full"
				model={file?.model}
				envOptions={sceneData?.environment}
				controlsOptions={sceneData?.controls}
				shadowsOptions={sceneData?.shadows}
				popover={<PreviewInfoPopover />}
				loader={<CenteredSpinner text="Preparing scene..." />}
				fallback={<CenteredSpinner text="Loading scene..." />}
			/>
		</div>
	)
})

const PreviewFullscreenPage = ({ params }: Route.ComponentProps) => {
	const [searchParams] = useSearchParams()

	const { file, loadFromServer } = useLoadModel()
	const [isLoadingScene, setIsLoadingScene] = useState(false)
	const [sceneData, setSceneData] = useState<SceneLoadResult>()

	const sceneId = params.sceneId
	const projectId = params.projectId

	const getSceneSettings = useCallback(async () => {
		if (!sceneId || !projectId) return

		setIsLoadingScene(true)

		const token = searchParams.get('token')?.trim() || undefined
		const endpointParams = new URLSearchParams({
			projectId,
			preview: '1'
		})

		if (token) {
			endpointParams.set('token', token)
		}

		try {
			const loadedSceneData = await loadFromServer({
				sceneId,
				serverOptions: {
					endpoint: `/api/scenes/${sceneId}?${endpointParams.toString()}`,
					apiKey: token
				}
			})

			setSceneData(loadedSceneData)
		} catch (error) {
			console.error('Failed to load preview scene:', error)
		} finally {
			setIsLoadingScene(false)
		}
	}, [loadFromServer, projectId, sceneId, searchParams])

	useEffect(() => {
		if (sceneId && projectId && !sceneData) {
			void getSceneSettings()
		}
	}, [getSceneSettings, projectId, sceneData, sceneId])

	if (isLoadingScene && !file?.model) {
		return <CenteredSpinner className="h-screen" text="Loading scene..." />
	}

	return <PreviewModel file={file} sceneData={sceneData} />
}

export default PreviewFullscreenPage
