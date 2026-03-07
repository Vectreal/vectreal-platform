import { SidebarProvider } from '@shared/components/ui/sidebar'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { Provider, useAtom } from 'jotai/react'
import { useCallback } from 'react'
import { data, Outlet } from 'react-router'

import { Route } from './+types/publisher-layout'
import { ControlsOverlay } from '../../components'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { buildSceneAggregate } from '../../lib/domain/scene/server/scene-aggregate.server'
import {
	getScene,
	getSceneFolder
} from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import {
	processAtom,
	publisherConfigStore
} from '../../lib/stores/publisher-config-store'
import { sceneOptimizationStore } from '../../lib/stores/scene-optimization-store'
import { sceneSettingsStore } from '../../lib/stores/scene-settings-store'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import type {
	PublishedSceneMetaResponse,
	PublisherLoaderData,
	SceneAggregateResponse
} from '../../types/api'
import type { ShouldRevalidateFunction } from 'react-router'

export const loader = async ({ request, params }: Route.LoaderArgs) => {
	const { client, headers } = await createSupabaseClient(request)
	const {
		data: { user },
		error: userError
	} = await client.auth.getUser()

	// Stale refresh token – clear the cookie and continue as unauthenticated.
	if (userError?.code === 'refresh_token_not_found') {
		try {
			await client.auth.signOut({ scope: 'local' })
		} catch {
			// Ignore cleanup errors
		}
	}

	const isMobile = isMobileRequest(request)

	const sceneId = params.sceneId?.trim() || null
	let projectId: string | null = null
	let currentProjectName: string | null = null
	let currentFolderId: string | null = null
	let currentFolderName: string | null = null

	let sceneAggregate: SceneAggregateResponse | null = null
	let publishedMeta: PublishedSceneMetaResponse | null = null

	if (sceneId && user?.id) {
		const scene = await getScene(sceneId, user.id)
		if (!scene) {
			throw new Response('Scene not found', { status: 404 })
		}

		projectId = scene.projectId
		currentFolderId = scene.folderId

		const [project, folder] = await Promise.all([
			getProject(scene.projectId, user.id),
			scene.folderId
				? getSceneFolder(scene.folderId, user.id)
				: Promise.resolve(null)
		])

		currentProjectName = project?.name ?? null
		currentFolderName = folder?.name ?? null

		sceneAggregate = await buildSceneAggregate(sceneId)
		publishedMeta = await getPublishedScenePreview(projectId, sceneId)
	}

	const loaderData = {
		isMobile,
		user: user || null,
		sceneId,
		projectId,
		currentLocation: {
			projectId,
			projectName: currentProjectName,
			folderId: currentFolderId,
			folderName: currentFolderName
		},
		sceneAggregate,
		publishedMeta
	}

	return data(loaderData as PublisherLoaderData, { headers })
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
								<ControlsOverlay {...(loaderData as PublisherLoaderData)} />
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
