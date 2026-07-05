import { useModelContext } from '@vctrl/hooks/use-load-model'
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition
} from 'react'
import { useLocation, useNavigate } from 'react-router'

import type {
	ImgTo3dGenerationStatus,
	ImgTo3dGenerationStatusResponse,
	ImgTo3dGenerationSubmitResponse
} from '../../types/api'
import type { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationPhase =
	| 'idle'
	| 'auth'
	| 'submitting'
	| 'queued'
	| 'starting'
	| 'processing'
	| 'downloading'
	| 'failed'

export interface GenerationState {
	phase: GenerationPhase
	progress: number | null
	message: string | null
	imageFile: File | null
	jobId: string | null
	jobToken: string | null
	retryable: boolean
}

export interface UseImgTo3dGenerationParams {
	userId: string | undefined
	targetProjectId: string | undefined
}

export interface UseImgTo3dGenerationResult {
	generationState: GenerationState
	isGenerating: boolean
	isPending: boolean
	startImageGeneration: (file: File) => void
	setGenerationError: (message: string, imageFile?: File | null) => void
	requireSignIn: (imageFile?: File | null) => void
	retryGeneration: () => void
	resetGenerationState: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INITIAL_GENERATION_STATE: GenerationState = {
	phase: 'idle',
	progress: null,
	message: null,
	imageFile: null,
	jobId: null,
	jobToken: null,
	retryable: false
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Statuses from the API that map directly to a GenerationPhase.
// 'succeeded' is absent because it is a transient API state that always
// triggers artifact download rather than becoming a stable UI phase.
type MappableApiPhase = Extract<ImgTo3dGenerationStatus, GenerationPhase>

function apiStatusToPhase(status: ImgTo3dGenerationStatus): MappableApiPhase | null {
	if (status === 'succeeded') return null
	return status as MappableApiPhase
}

export function getGenerationMessage(
	phase: GenerationPhase | ImgTo3dGenerationStatus,
	message?: string | null
): string {
	if (message?.trim()) return message
	switch (phase) {
		case 'auth':        return 'Sign in to generate a 3D model from a reference image.'
		case 'submitting':  return 'Uploading your image to the generation runtime.'
		case 'queued':      return 'Waiting for the on-demand runtime to start.'
		case 'starting':    return 'Booting the generation worker for your job.'
		case 'processing':  return 'Generating a 3D model from your image.'
		case 'downloading': return 'Downloading the generated model into the Publisher.'
		case 'failed':      return 'Image-to-3D generation failed.'
		default:            return 'Ready to generate from an image.'
	}
}

async function parseApiResponse<T>(response: Response): Promise<T> {
	const payload = await response
		.json()
		.catch(() => null) as { data?: T; error?: string } | null

	if (!response.ok || !payload) {
		throw new Error(payload?.error ?? `Request failed with status ${response.status}`)
	}

	return (payload.data ?? payload) as T
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImgTo3dGeneration({
	userId,
	targetProjectId
}: UseImgTo3dGenerationParams): UseImgTo3dGenerationResult {
	const navigate = useNavigate()
	const location = useLocation()
	const { load } = useModelContext()
	const [isPending, startTransition] = useTransition()
	const [generationState, setGenerationState] = useState<GenerationState>(INITIAL_GENERATION_STATE)
	const isUnmountedRef = useRef(false)
	// Flipped to true by resetGenerationState so the poll loop exits without
	// waiting for the component to unmount.
	const isAbortedRef = useRef(false)

	useEffect(() => {
		return () => {
			isUnmountedRef.current = true
		}
	}, [])

	const resetGenerationState = useCallback(() => {
		isAbortedRef.current = true
		setGenerationState(INITIAL_GENERATION_STATE)
	}, [])

	const setGenerationError = useCallback(
		(message: string, imageFile: File | null = null) => {
			setGenerationState({
				phase: 'failed',
				progress: null,
				message,
				imageFile,
				jobId: null,
				jobToken: null,
				retryable: false
			})
		},
		[]
	)

	const requireSignIn = useCallback(
		(imageFile: File | null = null) => {
			setGenerationState({
				phase: 'auth',
				progress: null,
				message: getGenerationMessage('auth'),
				imageFile,
				jobId: null,
				jobToken: null,
				retryable: false
			})
			const nextPath = `${location.pathname}${location.search}`
			navigate(`/sign-in?next=${encodeURIComponent(nextPath)}`)
		},
		[location.pathname, location.search, navigate]
	)

	const loadGeneratedArtifact = useCallback(
		async (jobId: string, jobToken: string, imageFile: File) => {
			setGenerationState({
				phase: 'downloading',
				progress: 100,
				message: getGenerationMessage('downloading'),
				imageFile,
				jobId,
				jobToken,
				retryable: false
			})

			const artifactResponse = await fetch(
				`/api/img-to-3d/generations/${jobId}/artifact?token=${encodeURIComponent(jobToken)}`
			)
			const artifactBlob = await artifactResponse.blob()

			if (!artifactResponse.ok) {
				let message = 'Failed to download generated model.'
				try {
					const payload = JSON.parse(await artifactBlob.text()) as { error?: string }
					message = payload.error ?? message
				} catch {
					// ignore malformed error payloads
				}
				throw new Error(message)
			}

			const basename = imageFile.name.replace(/\.[^.]+$/, '') || 'generated-model'
			const generatedModel = new File(
				[artifactBlob],
				`${basename}.glb`,
				{ type: artifactBlob.type || 'model/gltf-binary' }
			)

			startTransition(async () => {
				await load([generatedModel] as InputFileOrDirectory)
				// Reset to idle once the model is committed to the viewer.
				setGenerationState(INITIAL_GENERATION_STATE)
			})
		},
		[load, startTransition]
	)

	const pollGeneration = useCallback(
		async (jobId: string, jobToken: string, imageFile: File) => {
			let nextPollDelay = 2_500

			while (!isUnmountedRef.current && !isAbortedRef.current) {
				await delay(nextPollDelay)

				const statusResponse = await fetch(
					`/api/img-to-3d/generations/${jobId}?token=${encodeURIComponent(jobToken)}`
				)
				const statusData =
					await parseApiResponse<ImgTo3dGenerationStatusResponse>(statusResponse)

				if (statusData.status === 'succeeded') {
					await loadGeneratedArtifact(jobId, jobToken, imageFile)
					return
				}

				if (statusData.status === 'failed') {
					setGenerationState({
						phase: 'failed',
						progress: statusData.progress,
						message: getGenerationMessage('failed', statusData.message),
						imageFile,
						jobId,
						jobToken,
						retryable: statusData.retryable
					})
					return
				}

				// After 'succeeded' and 'failed' are handled above, TypeScript narrows
				// statusData.status to 'queued' | 'starting' | 'processing' — all valid GenerationPhase values.
				const phase: GenerationPhase = statusData.status
				setGenerationState({
					phase,
					progress: statusData.progress,
					message: getGenerationMessage(phase, statusData.message),
					imageFile,
					jobId,
					jobToken,
					retryable: false
				})

				nextPollDelay = statusData.pollAfterMs
			}
		},
		[loadGeneratedArtifact]
	)

	const startImageGeneration = useCallback(
		async (imageFile: File) => {
			if (!userId) {
				requireSignIn(imageFile)
				return
			}

			// Clear any previous abort so a fresh generation can run to completion.
			isAbortedRef.current = false

			setGenerationState({
				phase: 'submitting',
				progress: 10,
				message: getGenerationMessage('submitting'),
				imageFile,
				jobId: null,
				jobToken: null,
				retryable: false
			})

			try {
				const formData = new FormData()
				formData.append('images', imageFile)
				if (targetProjectId) {
					formData.append('targetProjectId', targetProjectId)
				}

				const submitResponse = await fetch('/api/img-to-3d/generations', {
					method: 'POST',
					body: formData
				})

				if (submitResponse.status === 401) {
					requireSignIn(imageFile)
					return
				}

				const submitData =
					await parseApiResponse<ImgTo3dGenerationSubmitResponse>(submitResponse)

				const job = submitData.jobs[0]
				if (!job) {
					throw new Error('No generation job was returned by the server.')
				}

				// apiStatusToPhase returns null only for 'succeeded', which is unexpected
				// at submission time and is handled defensively by falling back to 'queued'.
				const phase = apiStatusToPhase(job.status) ?? 'queued'

				setGenerationState({
					phase,
					progress: phase === 'queued' ? 15 : 25,
					message: getGenerationMessage(phase),
					imageFile,
					jobId: job.jobId,
					jobToken: job.jobToken,
					retryable: false
				})

				await pollGeneration(job.jobId, job.jobToken, imageFile)
			} catch (error) {
				setGenerationState({
					phase: 'failed',
					progress: null,
					message:
						error instanceof Error
							? error.message
							: 'Failed to start image generation.',
					imageFile,
					jobId: null,
					jobToken: null,
					retryable: true
				})
			}
		},
		[pollGeneration, requireSignIn, targetProjectId, userId]
	)

	const retryGeneration = useCallback(() => {
		if (!generationState.imageFile) return
		void startImageGeneration(generationState.imageFile)
	}, [generationState.imageFile, startImageGeneration])

	const isGenerating =
		generationState.phase !== 'idle' &&
		generationState.phase !== 'failed' &&
		generationState.phase !== 'auth'

	return {
		generationState,
		isGenerating,
		isPending,
		startImageGeneration: (file) => {
			void startImageGeneration(file)
		},
		setGenerationError,
		requireSignIn,
		retryGeneration,
		resetGenerationState
	}
}
