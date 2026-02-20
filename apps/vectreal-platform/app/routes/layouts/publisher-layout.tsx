import { SidebarProvider } from '@shared/components/ui/sidebar'
import { User } from '@supabase/supabase-js'
import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { Provider, useAtom, useAtomValue } from 'jotai/react'
import { useCallback } from 'react'
import { Outlet } from 'react-router'

import { Navigation } from '../../components/navigation'
import {
	PublisherButtons,
	PublisherSidebar,
	SaveButton,
	Stepper
} from '../../components/publisher'
import { useSceneLoader } from '../../hooks'
import {
	processAtom,
	publisherConfigStore
} from '../../lib/stores/publisher-config-store'
import { sceneOptimizationStore } from '../../lib/stores/scene-optimization-store'
import { getScene } from '../../lib/domain/scene/scene-folder-repository.server'
import { sceneSettingsService } from '../../lib/domain/scene/scene-settings-service.server'

import { sceneSettingsStore } from '../../lib/stores/scene-settings-store'
import { createSupabaseClient } from '../../lib/supabase.server'
import type {
	SceneAggregateResponse,
	SceneAssetDataMap,
	SerializedSceneAssetDataMap
} from '../../types/api'

import { Route } from './+types/publisher-layout'

function serializeAssetData(
	assetData: SceneAssetDataMap | null
): SerializedSceneAssetDataMap {
	const serialized: SerializedSceneAssetDataMap = {}

	assetData?.forEach((value, key) => {
		serialized[key] = {
			data: Array.from(value.data),
			mimeType: value.mimeType,
			fileName: value.fileName
		}
	})

	return serialized
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
	const { client } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()
	const sceneId = params.sceneId?.trim() || null

	let sceneAggregate: SceneAggregateResponse | null = null

	if (sceneId && user?.id) {
		const scene = await getScene(sceneId, user.id)
		if (!scene) {
			throw new Response('Scene not found', { status: 404 })
		}

		const [settingsResult, stats] = await Promise.all([
			sceneSettingsService.getSceneSettingsWithAssets(sceneId),
			sceneSettingsService.getSceneStats(sceneId)
		])

		sceneAggregate = {
			sceneId,
			stats,
			settings: settingsResult
				? {
						environment: settingsResult.environment ?? undefined,
						controls: settingsResult.controls ?? undefined,
						shadows: settingsResult.shadows ?? undefined,
						meta: settingsResult.meta ?? undefined
					}
				: null,
			gltfJson: settingsResult?.gltfJson ?? null,
			assetData: settingsResult
				? serializeAssetData(settingsResult.assetDataMap)
				: null,
			assets: settingsResult?.assets ?? null
		}
	}

	const loaderData = {
		user: user || null,
		sceneId,
		sceneAggregate
	}

	return loaderData
}

interface OverlayControlsProps {
	user: User | null
	sceneId: string | null
	sceneAggregate: Route.ComponentProps['loaderData']['sceneAggregate']
}

const OverlayControls = ({
	user,
	sceneId,
	sceneAggregate
}: OverlayControlsProps) => {
	const { file } = useModelContext()
	const { step, hasUnsavedChanges } = useAtomValue(processAtom)

	// Centralized scene loader - single source of truth (must be inside ModelProvider)
	// This hook manages scene loading/saving but doesn't return state available via atoms
	const { saveSceneSettings } = useSceneLoader({
		sceneId,
		userId: user?.id,
		autoLoad: !sceneAggregate,
		initialSceneAggregate: sceneAggregate as SceneAggregateResponse | null
	})

	const isUploadStep = !file?.model && step === 'uploading'

	return isUploadStep ? (
		<Navigation user={user} />
	) : (
		<>
			<Stepper />
			<PublisherSidebar user={user} />
			<SaveButton
				sceneId={sceneId}
				userId={user?.id}
				saveSceneSettings={saveSceneSettings}
				hasUnsavedChanges={hasUnsavedChanges}
			/>
			<PublisherButtons />
		</>
	)
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	const optimizer = useOptimizeModel()
	const [{ showSidebar }, setProcessState] = useAtom(processAtom)
	const { user, sceneId, sceneAggregate } = loaderData

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			setProcessState((prev) => ({
				...prev,
				showSidebar: isOpen
			}))
		},
		[setProcessState]
	)

	return (
		<ModelProvider optimizer={optimizer}>
			<SidebarProvider open={showSidebar} onOpenChange={handleOpenChange}>
				<Provider store={publisherConfigStore}>
					<Provider store={sceneOptimizationStore}>
						<Provider store={sceneSettingsStore}>
							<main className="flex h-screen w-full flex-col overflow-hidden">
								<OverlayControls
									user={user}
									sceneId={sceneId}
									sceneAggregate={sceneAggregate}
								/>
								<Outlet />
							</main>
						</Provider>
					</Provider>
				</Provider>
			</SidebarProvider>
		</ModelProvider>
	)
}

export default Layout
