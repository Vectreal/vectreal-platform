import { SidebarProvider } from '@shared/components/ui/sidebar'
import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { Provider, useAtom, useAtomValue } from 'jotai/react'
import { useCallback } from 'react'
import { data, Outlet } from 'react-router'

import { Navigation } from '../../components/navigation'
import {
	PublisherButtons,
	PublisherSidebar,
	SaveButton,
	Stepper
} from '../../components/publisher'
import { useSceneLoader } from '../../hooks'
import { Route } from './+types/publisher-layout'
import { buildSceneAggregate } from '../../lib/domain/scene/scene-aggregate.server'
import { getScene } from '../../lib/domain/scene/scene-folder-repository.server'
import {
	processAtom,
	publisherConfigStore
} from '../../lib/stores/publisher-config-store'
import { sceneOptimizationStore } from '../../lib/stores/scene-optimization-store'
import { sceneSettingsStore } from '../../lib/stores/scene-settings-store'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import type { SceneAggregateResponse } from '../../types/api'
import type { ShouldRevalidateFunction } from 'react-router'

export const loader = async ({ request, params }: Route.LoaderArgs) => {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()

	const isMobile = isMobileRequest(request)

	const sceneId = params.sceneId?.trim() || null

	let sceneAggregate: SceneAggregateResponse | null = null

	if (sceneId && user?.id) {
		const scene = await getScene(sceneId, user.id)
		if (!scene) {
			throw new Response('Scene not found', { status: 404 })
		}

		sceneAggregate = await buildSceneAggregate(sceneId)
	}

	const loaderData = {
		isMobile,
		user: user || null,
		sceneId,
		sceneAggregate,
		sceneMeta: sceneAggregate?.meta ?? null
	}

	return data(loaderData, { headers })
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
	actionResult,
	formMethod
}) => {
	if (formMethod && formMethod !== 'GET') {
		return true
	}

	if (actionResult) {
		return true
	}

	if (currentUrl.pathname === nextUrl.pathname) {
		return false
	}

	return defaultShouldRevalidate
}

const OverlayControls = ({
	isMobile,
	user,
	sceneId,
	sceneAggregate
}: Route.ComponentProps['loaderData']) => {
	const { file } = useModelContext()
	const { step, hasUnsavedChanges } = useAtomValue(processAtom)

	// Centralized scene loader - single source of truth (must be inside ModelProvider)
	// This hook manages scene loading/saving but doesn't return state available via atoms
	const { saveSceneSettings, saveAvailability } = useSceneLoader({
		sceneId,
		userId: user?.id,
		initialSceneAggregate: sceneAggregate as SceneAggregateResponse | null,
		sceneMeta: sceneAggregate?.meta ?? null
	})

	const isUploadStep = !file?.model && step === 'uploading'

	return isUploadStep ? (
		<Navigation user={user} isMobile={isMobile} />
	) : (
		<>
			<Stepper />
			<PublisherSidebar user={user} />
			<SaveButton
				sceneId={sceneId}
				userId={user?.id}
				saveSceneSettings={saveSceneSettings}
				hasUnsavedChanges={hasUnsavedChanges}
				saveAvailability={saveAvailability}
			/>
			<PublisherButtons />
		</>
	)
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	const optimizer = useOptimizeModel()
	const [{ showSidebar }, setProcessState] = useAtom(processAtom)

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
								<OverlayControls {...loaderData} />
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
