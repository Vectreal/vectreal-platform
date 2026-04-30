import { SidebarProvider } from '@shared/components/ui/sidebar'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { Provider, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useLayoutEffect } from 'react'
import { data, Outlet, type MetaFunction } from 'react-router'

import { Route } from './+types/publisher-layout'
import { ControlsOverlay } from '../../components'
import { PublisherViewerCaptureProvider } from '../../components/publisher/publisher-viewer-capture-context'
import { UpgradeModal } from '../../components/upgrade/upgrade-modal'
import { useAuthResumeRevalidation } from '../../hooks/use-auth-resume-revalidation'
import { getProject } from '../../lib/domain/project/project-repository.server'
import { buildSceneAggregate } from '../../lib/domain/scene/server/scene-aggregate.server'
import {
	getScene,
	getSceneFolder
} from '../../lib/domain/scene/server/scene-folder-repository.server'
import { getPublishedScenePreview } from '../../lib/domain/scene/server/scene-preview-repository.server'
import { buildMeta } from '../../lib/seo'
import { hasSupabaseAuthCookie } from '../../lib/sessions/supabase-auth-cookie.server'
import {
	currentLocationAtom,
	processAtom,
	publisherConfigStore,
	saveLocationAtom,
	showSidebarAtom
} from '../../lib/stores/publisher-config-store'
import { sceneOptimizationStore } from '../../lib/stores/scene-optimization-store'
import { sceneSettingsStore } from '../../lib/stores/scene-settings-store'
import { upgradeModalStore } from '../../lib/stores/upgrade-modal-store'
import { createSupabaseClient } from '../../lib/supabase.server'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import type {
	PublishedSceneMetaResponse,
	PublisherLoaderData,
	SceneAggregateResponse
} from '../../types/api'
import type { User } from '@supabase/supabase-js'
import type { ShouldRevalidateFunction } from 'react-router'

export const meta: MetaFunction = () =>
	buildMeta(
		[
			{ title: 'Publisher — Vectreal' },
			{ property: 'og:title', content: 'Publisher — Vectreal' }
		],
		undefined,
		{ private: true }
	)

export const loader = async ({ request, params }: Route.LoaderArgs) => {
	const requestCookieHeader = request.headers.get('Cookie') ?? ''
	const hasAuthCookie = hasSupabaseAuthCookie(requestCookieHeader)

	let user: null | User = null
	let headers = new Headers()

	if (hasAuthCookie) {
		const supabase = await createSupabaseClient(request)
		headers = supabase.headers
		const {
			data: { user: authUser },
			error: userError
		} = await supabase.client.auth.getUser()

		// Stale refresh token – clear the cookie and continue as unauthenticated.
		if (userError?.code === 'refresh_token_not_found') {
			try {
				await supabase.client.auth.signOut({ scope: 'local' })
			} catch {
				// Ignore cleanup errors
			}
		} else if (authUser) {
			user = authUser
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

		const [project, folder, aggregate, scenePublishedMeta] = await Promise.all([
			getProject(scene.projectId, user.id),
			scene.folderId
				? getSceneFolder(scene.folderId, user.id)
				: Promise.resolve(null),
			buildSceneAggregate(sceneId),
			getPublishedScenePreview(scene.projectId, sceneId).catch(() => null)
		])

		currentProjectName = project?.name ?? null
		currentFolderName = folder?.name ?? null
		sceneAggregate = aggregate
		publishedMeta = scenePublishedMeta
	} else if (!sceneId && user?.id) {
		// New scene — read project/folder context from URL search params
		const url = new URL(request.url)
		const contextProjectId = url.searchParams.get('projectId')?.trim() || null
		const contextFolderId = url.searchParams.get('folderId')?.trim() || null

		if (contextProjectId) {
			try {
				const [project, folder] = await Promise.all([
					getProject(contextProjectId, user.id),
					contextFolderId
						? getSceneFolder(contextFolderId, user.id)
						: Promise.resolve(null)
				])
				if (project) {
					projectId = contextProjectId
					currentProjectName = project.name
					currentFolderId = folder?.id ?? null
					currentFolderName = folder?.name ?? null
				}
			} catch {
				// Invalid project/folder params — silently ignore, user picks in UI
			}
		}
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

	return defaultShouldRevalidate
}

const PublisherLayoutContent = ({
	loaderData
}: {
	loaderData: PublisherLoaderData
}) => {
	const showSidebar = useAtomValue(showSidebarAtom)
	const setProcessState = useSetAtom(processAtom)
	const setCurrentLocation = useSetAtom(currentLocationAtom)
	const setSaveLocation = useSetAtom(saveLocationAtom)
	useAuthResumeRevalidation({ enabled: Boolean(loaderData.user) })

	const { currentLocation, projectId } = loaderData
	useLayoutEffect(() => {
		setCurrentLocation(currentLocation)
		setSaveLocation({
			targetProjectId: currentLocation.projectId ?? projectId ?? undefined,
			targetFolderId: currentLocation.folderId ?? null
		})
	}, [currentLocation, projectId, setCurrentLocation, setSaveLocation])

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
		<SidebarProvider open={showSidebar} onOpenChange={handleOpenChange}>
			<PublisherViewerCaptureProvider>
				<main className="flex h-screen w-full flex-col overflow-hidden">
					<UpgradeModal />
					<ControlsOverlay {...loaderData} />
					<Outlet />
				</main>
			</PublisherViewerCaptureProvider>
		</SidebarProvider>
	)
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	const optimizer = useOptimizeModel()
	const resolvedLoaderData = loaderData as PublisherLoaderData

	return (
		<ModelProvider optimizer={optimizer}>
			<Provider store={upgradeModalStore}>
				<Provider store={publisherConfigStore}>
					<Provider store={sceneOptimizationStore}>
						<Provider store={sceneSettingsStore}>
							<PublisherLayoutContent loaderData={resolvedLoaderData} />
						</Provider>
					</Provider>
				</Provider>
			</Provider>
		</ModelProvider>
	)
}

export default Layout
