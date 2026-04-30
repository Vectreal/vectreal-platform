import { Input } from '@shared/components/ui/input'
import { Separator } from '@shared/components/ui/separator'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { Skeleton } from '@shared/components/ui/skeleton'
import { cn } from '@shared/utils'
import { motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai/react'
import { ChevronDown, FolderOpen } from 'lucide-react'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent
} from 'react'
import { useFetcher } from 'react-router'

import { useLocationChangeState } from '../../../hooks/use-location-change-state'
import {
	currentLocationAtom,
	saveLocationAtom,
	sceneMetaAtom
} from '../../../lib/stores/publisher-config-store'

import type { SceneLocationOptionsResponse } from '../../../types/api'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT_FOLDER_VALUE = '__root__'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationOptionsEnvelope = {
	data?: SceneLocationOptionsResponse
	projects?: SceneLocationOptionsResponse['projects']
	folders?: SceneLocationOptionsResponse['folders']
	selectedProjectId?: string | null
}

function parseLocationOptions(
	payload: unknown
): SceneLocationOptionsResponse | null {
	if (!payload || typeof payload !== 'object') return null
	const envelope = payload as LocationOptionsEnvelope
	const data = (envelope.data ?? envelope) as LocationOptionsEnvelope
	if (!Array.isArray(data.projects) || !Array.isArray(data.folders)) return null
	return {
		projects: data.projects,
		folders: data.folders,
		selectedProjectId:
			typeof data.selectedProjectId === 'string' ? data.selectedProjectId : null
	}
}

// ---------------------------------------------------------------------------
// Scene name — inline click-to-edit
// ---------------------------------------------------------------------------

const SceneNameField = () => {
	const [sceneMeta, setSceneMeta] = useAtom(sceneMetaAtom)
	const sceneName = sceneMeta.name
	const [isEditing, setIsEditing] = useState(false)
	const [localName, setLocalName] = useState(sceneName ?? '')
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (!isEditing) setLocalName(sceneName ?? '')
	}, [sceneName, isEditing])

	const saveChanges = useCallback(() => {
		const trimmedName = localName.trim()
		if (trimmedName && trimmedName !== sceneName) {
			setSceneMeta((prev) => ({ ...prev, name: trimmedName }))
		} else if (!trimmedName) {
			setLocalName(sceneName ?? '')
		}
		setIsEditing(false)
	}, [localName, sceneName, setSceneMeta])

	useEffect(() => {
		if (!isEditing) return
		function handleClickOutside(event: MouseEvent) {
			if (inputRef.current && !inputRef.current.contains(event.target as Node))
				saveChanges()
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isEditing, saveChanges])

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus()
			inputRef.current?.select()
		}
	}, [isEditing])

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') saveChanges()
		else if (e.key === 'Escape') {
			setLocalName(sceneName ?? '')
			setIsEditing(false)
		}
	}

	return (
		<div className="relative min-w-0 grow">
			{isEditing ? (
				<div className="relative flex w-full items-center">
					<Input
						ref={inputRef}
						type="text"
						value={localName}
						onChange={(e) => setLocalName(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={saveChanges}
						className="focus: w-full rounded-sm bg-transparent px-2! py-1! text-sm transition-all duration-300 not-[:focus]:border-0"
						aria-label="Scene name"
					/>
					<span
						className="bg-accent absolute top-1/2 right-2 h-1.5 w-1.5 -translate-y-1/2 animate-pulse rounded-full"
						aria-hidden="true"
					/>
				</div>
			) : (
				<button
					onClick={() => setIsEditing(true)}
					className="text-foreground/90 hover:text-foreground flex w-full items-center rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors"
				>
					<span className="w-full truncate text-left">{sceneName}</span>
				</button>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Location picker — expandable section with project + folder selects
// ---------------------------------------------------------------------------

interface LocationPickerProps {
	open: boolean
}

const LocationPicker = ({ open }: LocationPickerProps) => {
	const [saveLocation, setSaveLocation] = useAtom(saveLocationAtom)
	const fetcher = useFetcher<LocationOptionsEnvelope>()
	const requestedProjectIdRef = useRef<string | null>(null)
	const options = useMemo(
		() => parseLocationOptions(fetcher.data),
		[fetcher.data]
	)

	const selectedProjectId = saveLocation.targetProjectId ?? ''
	const selectedFolderId = saveLocation.targetFolderId ?? ROOT_FOLDER_VALUE

	const projects = options?.projects ?? []
	const folders = options?.folders ?? []
	const hasLoadedOptions = Boolean(options)
	const isInitialLoading = fetcher.state !== 'idle' && !hasLoadedOptions
	const isRefreshingFolders = fetcher.state !== 'idle' && hasLoadedOptions

	// Fetch options when expandend or when project changes
	useEffect(() => {
		if (!open) return
		const projectId = selectedProjectId || null
		if (
			requestedProjectIdRef.current === projectId &&
			(fetcher.state !== 'idle' || fetcher.data)
		)
			return
		requestedProjectIdRef.current = projectId
		const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
		fetcher.load(`/api/scene-location-options${query}`)
	}, [open, selectedProjectId, fetcher])

	// If no project is selected yet but API returned a suggestion, ignore it
	// (we deliberately do NOT auto-select; user must choose)

	// If a folder from a previous project is selected, reset to root
	useEffect(() => {
		if (!hasLoadedOptions) return
		if (!selectedProjectId) return
		if (selectedFolderId === ROOT_FOLDER_VALUE) return
		if (!folders.some((f) => f.id === selectedFolderId)) {
			setSaveLocation((prev) => ({ ...prev, targetFolderId: null }))
		}
	}, [
		hasLoadedOptions,
		selectedProjectId,
		folders,
		selectedFolderId,
		setSaveLocation
	])

	const handleProjectChange = (value: string) => {
		setSaveLocation({ targetProjectId: value, targetFolderId: null })
	}

	const handleFolderChange = (value: string) => {
		setSaveLocation((prev) => ({
			...prev,
			targetFolderId: value === ROOT_FOLDER_VALUE ? null : value
		}))
	}

	return (
		<motion.div
			initial={false}
			animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
			transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
			className="overflow-hidden"
		>
			<div className="space-y-2 px-2 pt-1 pb-2">
				{isInitialLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				) : (
					<>
						<Select
							value={selectedProjectId || undefined}
							onValueChange={handleProjectChange}
						>
							<SelectTrigger size="sm" className="w-full">
								<SelectValue placeholder="Choose project…" />
							</SelectTrigger>
							<SelectContent>
								{projects.length === 0 ? (
									<SelectItem value="__none__" disabled>
										No projects available
									</SelectItem>
								) : (
									projects.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>

						{isRefreshingFolders ? (
							<Skeleton className="h-8 w-full" />
						) : (
							<Select
								value={selectedFolderId}
								onValueChange={handleFolderChange}
								disabled={!selectedProjectId}
							>
								<SelectTrigger size="sm" className="w-full">
									<SelectValue placeholder="Root folder" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={ROOT_FOLDER_VALUE}>Root</SelectItem>
									{folders.map((folder) => (
										<SelectItem key={folder.id} value={folder.id}>
											{folder.depth > 0
												? `${'  '.repeat(folder.depth)}↳ ${folder.name}`
												: folder.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</>
				)}
			</div>
		</motion.div>
	)
}

// ---------------------------------------------------------------------------
// Location row — collapsed breadcrumb trigger
// ---------------------------------------------------------------------------

interface LocationRowProps {
	open: boolean
	authenticated: boolean
	onToggle: () => void
}

const LocationRow = ({ open, authenticated, onToggle }: LocationRowProps) => {
	const currentLocation = useAtomValue(currentLocationAtom)
	const { hasUnsavedLocationChange } = useLocationChangeState()

	const projectLabel = currentLocation.projectName
	const folderLabel = currentLocation.folderName ?? 'Root'
	const locationLabel = projectLabel ? `${projectLabel} / ${folderLabel}` : null

	if (!authenticated) return null

	return (
		<button
			onClick={onToggle}
			className={cn(
				'text-muted-foreground hover:text-foreground group flex max-w-full min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors',
				open && 'text-foreground'
			)}
			aria-expanded={open}
			aria-label="Toggle save location picker"
		>
			<FolderOpen className="h-3 w-3 shrink-0" />
			<span className="min-w-0 grow truncate text-left">
				{locationLabel ?? (
					<span className="text-muted-foreground/60 italic">
						Choose save location…
					</span>
				)}
			</span>
			{hasUnsavedLocationChange && locationLabel && (
				<span
					className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full"
					aria-hidden="true"
				/>
			)}
			<ChevronDown
				className={cn(
					'h-3 w-3 shrink-0 transition-transform duration-200',
					open && 'rotate-180'
				)}
			/>
		</button>
	)
}

// ---------------------------------------------------------------------------
// Composed component
// ---------------------------------------------------------------------------

interface SceneNameAndLocationProps {
	authenticated: boolean
	className?: string
}

export function SceneNameAndLocation({
	authenticated,
	className
}: SceneNameAndLocationProps) {
	const [locationOpen, setLocationOpen] = useState(false)

	const toggleLocation = useCallback(() => setLocationOpen((prev) => !prev), [])

	// Close when clicking outside — but ignore clicks inside Radix portals
	// (SelectContent, DropdownMenu, etc. render outside the DOM tree via portals,
	//  so containerRef.contains() returns false for them, causing false closes)
	const containerRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!locationOpen) return
		function handleMouseDown(e: MouseEvent) {
			const target = e.target as Element
			// Ignore clicks inside any Radix popper/portal overlay
			if (target.closest?.('[data-radix-popper-content-wrapper]')) return
			if (containerRef.current && !containerRef.current.contains(target)) {
				setLocationOpen(false)
			}
		}
		document.addEventListener('mousedown', handleMouseDown)
		return () => document.removeEventListener('mousedown', handleMouseDown)
	}, [locationOpen])

	return (
		<div
			ref={containerRef}
			className={cn(
				'bg-muted/50 min-w-0 grow overflow-hidden rounded-xl',
				className
			)}
		>
			<div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
				<div className="min-w-0 flex-1">
					<SceneNameField />
				</div>
				{authenticated ? (
					<>
						<Separator orientation="vertical" className="h-4 shrink-0" />
						<div className="max-w-[48%] min-w-0 shrink">
							<LocationRow
								open={locationOpen}
								authenticated={authenticated}
								onToggle={toggleLocation}
							/>
						</div>
					</>
				) : null}
			</div>
			{locationOpen ? <Separator /> : null}
			{/* Always mounted — LocationPicker's motion.div handles height 0↔auto.
			    Keeping it mounted preserves fetcher data and avoids remount flicker. */}
			<LocationPicker open={locationOpen} />
		</div>
	)
}
