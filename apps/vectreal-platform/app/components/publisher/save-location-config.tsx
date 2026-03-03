import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Skeleton } from '@shared/components/ui/skeleton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher } from 'react-router'

import type { SaveLocationTarget } from '../../hooks'
import type {
	SceneCurrentLocation,
	SceneLocationOptionsResponse
} from '../../types/api'

const ROOT_FOLDER_VALUE = '__root__'

type SceneLocationOptionsEnvelope = {
	data?: SceneLocationOptionsResponse
	projects?: SceneLocationOptionsResponse['projects']
	folders?: SceneLocationOptionsResponse['folders']
	selectedProjectId?: string | null
}

function parseLocationOptions(
	payload: unknown
): SceneLocationOptionsResponse | null {
	if (!payload || typeof payload !== 'object') {
		return null
	}

	const envelope = payload as SceneLocationOptionsEnvelope
	const data = (envelope.data ?? envelope) as SceneLocationOptionsEnvelope

	if (!Array.isArray(data.projects) || !Array.isArray(data.folders)) {
		return null
	}

	return {
		projects: data.projects,
		folders: data.folders,
		selectedProjectId:
			typeof data.selectedProjectId === 'string' ? data.selectedProjectId : null
	}
}

interface SaveLocationConfigProps {
	readonly currentLocation: SceneCurrentLocation
	readonly fallbackProjectId: string | null
	readonly onChange: (target: SaveLocationTarget) => void
}

const SaveLocationConfig = ({
	currentLocation,
	fallbackProjectId,
	onChange
}: SaveLocationConfigProps) => {
	const fetcher = useFetcher<SceneLocationOptionsEnvelope>()
	const requestedProjectIdRef = useRef<string | null>(null)
	const options = useMemo(
		() => parseLocationOptions(fetcher.data),
		[fetcher.data]
	)
	const [selectedProjectId, setSelectedProjectId] = useState<string>(
		currentLocation.projectId ?? fallbackProjectId ?? ''
	)
	const [selectedFolderId, setSelectedFolderId] = useState<string>(
		currentLocation.folderId ?? ROOT_FOLDER_VALUE
	)

	const projects = options?.projects ?? []
	const folders = options?.folders ?? []
	const hasLoadedOptions = Boolean(options)
	const isInitialLoading = fetcher.state !== 'idle' && !hasLoadedOptions
	const isRefreshingOptions = fetcher.state !== 'idle' && hasLoadedOptions

	useEffect(() => {
		const requestProjectId = selectedProjectId || null

		if (requestedProjectIdRef.current === requestProjectId) {
			if (fetcher.state !== 'idle' || fetcher.data) {
				return
			}
		}

		requestedProjectIdRef.current = requestProjectId
		const query = selectedProjectId
			? `?projectId=${encodeURIComponent(selectedProjectId)}`
			: ''
		fetcher.load(`/api/scene-location-options${query}`)
	}, [fetcher, selectedProjectId, fetcher.data, fetcher.state])

	useEffect(() => {
		if (!selectedProjectId && options?.selectedProjectId) {
			setSelectedProjectId(options.selectedProjectId)
		}
	}, [options?.selectedProjectId, selectedProjectId])

	useEffect(() => {
		if (selectedFolderId === ROOT_FOLDER_VALUE) {
			return
		}

		if (!folders.some((folder) => folder.id === selectedFolderId)) {
			setSelectedFolderId(ROOT_FOLDER_VALUE)
		}
	}, [folders, selectedFolderId])

	useEffect(() => {
		onChange({
			targetProjectId: selectedProjectId || undefined,
			targetFolderId:
				selectedFolderId === ROOT_FOLDER_VALUE ? null : selectedFolderId
		})
	}, [onChange, selectedFolderId, selectedProjectId])

	const currentProjectLabel = currentLocation.projectName ?? 'Not saved yet'
	const currentFolderLabel = currentLocation.folderName ?? 'Root'

	return (
		<div className="w-full space-y-6 overflow-hidden p-2">
			<div className="space-y-3">
				<p className="text-xs font-medium">Save location</p>
				<div className="bg-muted/60 rounded-md px-2 py-1.5 text-xs">
					<p className="text-muted-foreground">Current</p>
					<p className="truncate font-medium">
						{currentProjectLabel} / {currentFolderLabel}
					</p>
				</div>
			</div>

			{isInitialLoading ? (
				<div className="flex items-center gap-2">
					<Skeleton className="h-9 w-[9.5rem]" />
					<Skeleton className="h-3 w-2 rounded-sm" />
					<Skeleton className="h-9 w-[9.5rem]" />
				</div>
			) : (
				<div className="w-full space-y-3">
					<p className="text-muted-foreground text-xs">Project / Folder</p>
					<div className="flex items-center gap-2">
						<Select
							value={selectedProjectId || undefined}
							onValueChange={(value) => {
								setSelectedProjectId(value)
								setSelectedFolderId(ROOT_FOLDER_VALUE)
							}}
						>
							<SelectTrigger className="grow">
								<SelectValue placeholder="Project" />
							</SelectTrigger>
							<SelectContent>
								{projects.length === 0 && (
									<SelectItem value="__no_projects__" disabled>
										No projects available
									</SelectItem>
								)}
								{projects.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										{project.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<span className="text-muted-foreground px-0.5 text-sm">/</span>

						{isRefreshingOptions ? (
							<Skeleton className="h-9 w-[9.5rem]" />
						) : (
							<Select
								value={selectedFolderId}
								onValueChange={setSelectedFolderId}
							>
								<SelectTrigger className="shrink-0 grow">
									<SelectValue placeholder="Folder" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ROOT_FOLDER_VALUE}>Root</SelectItem>
									{folders.length === 0 && (
										<SelectItem value="__no_folders__" disabled>
											No root folders
										</SelectItem>
									)}
									{folders.map((folder) => (
										<SelectItem key={folder.id} value={folder.id}>
											{folder.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

export default SaveLocationConfig
