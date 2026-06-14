import { useAcceptPattern } from '@shared/components/hooks/use-accept-pattern'
import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { Progress } from '@shared/components/ui/progress'
import { cn } from '@shared/utils'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import {
	Book,
	ExternalLink,
	FileQuestion,
	FolderUp,
	ImagePlus,
	Upload
} from 'lucide-react'
import {
	type ChangeEvent,
	ComponentProps,
	SyntheticEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition
} from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useLocation, useNavigate, useNavigation } from 'react-router'

import BasicCard from '../../components/layout-components/basic-card'
import type {
	TrellisGenerationStatus,
	TrellisGenerationStatusResponse,
	TrellisGenerationSubmitResponse
} from '../../types/api'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		// extends React's HTMLAttributes
		directory?: string
		webkitdirectory?: string
	}
}

interface Props {
	isMobile?: boolean
	targetProjectId?: string
	userId?: string
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

type GenerationPhase =
	| 'idle'
	| 'auth'
	| 'submitting'
	| 'queued'
	| 'starting'
	| 'processing'
	| 'downloading'
	| 'failed'

interface GenerationState {
	phase: GenerationPhase
	progress: null | number
	message: null | string
	imageFile: File | null
	jobId: null | string
	jobToken: null | string
	retryable: boolean
}

const initialGenerationState: GenerationState = {
	phase: 'idle',
	progress: null,
	message: null,
	imageFile: null,
	jobId: null,
	jobToken: null,
	retryable: false
}

function isSupportedImageFile(file: File): boolean {
	return IMAGE_MIME_TYPES.has(file.type)
}

function isImageOnlyDrop(files: File[]): boolean {
	return files.length > 0 && files.every(isSupportedImageFile)
}

function getGenerationMessage(
	status: GenerationPhase | TrellisGenerationStatus,
	message?: null | string
): string {
	if (message?.trim()) {
		return message
	}

	switch (status) {
		case 'auth':
			return 'Sign in to generate a 3D model from a reference image.'
		case 'submitting':
			return 'Uploading your image to the Trellis runtime.'
		case 'queued':
			return 'Waiting for the on-demand runtime to start.'
		case 'starting':
			return 'Booting the Trellis worker for your generation job.'
		case 'processing':
			return 'Generating a 3D model from your image.'
		case 'downloading':
			return 'Downloading the generated model into the Publisher.'
		case 'failed':
			return 'Image-to-3D generation failed.'
		default:
			return 'Ready to generate from an image.'
	}
}

async function parseApiResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json().catch(() => null)) as
		| { data?: T; error?: string }
		| null

	if (!response.ok || !payload) {
		throw new Error(payload?.error || `Request failed with status ${response.status}`)
	}

	return (payload.data ?? payload) as T
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export const DropZone = ({ isMobile, targetProjectId, userId }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)
	const { load } = useModelContext()

	const [isPending, startTransition] = useTransition()
	const [generationState, setGenerationState] =
		useState<GenerationState>(initialGenerationState)
	const navigation = useNavigation()
	const navigate = useNavigate()
	const location = useLocation()
	const imageInputRef = useRef<HTMLInputElement | null>(null)
	const isUnmountedRef = useRef(false)

	// Show a loading state when files are being processed or when navigating
	// within the publisher (e.g. to a newly created scene route).
	const isNavigationLoading =
		navigation.state === 'loading' &&
		Boolean(navigation.location?.pathname?.startsWith('/publisher'))

	const isGenerating =
		generationState.phase !== 'idle' &&
		generationState.phase !== 'failed' &&
		generationState.phase !== 'auth'
	const isLoading = isPending || isNavigationLoading || isGenerating

	useEffect(() => {
		return () => {
			isUnmountedRef.current = true
		}
	}, [])

	const resetGenerationState = useCallback(() => {
		setGenerationState(initialGenerationState)
	}, [])

	const redirectToSignIn = useCallback(() => {
		const nextPath = `${location.pathname}${location.search}`
		navigate(`/sign-in?next=${encodeURIComponent(nextPath)}`)
	}, [location.pathname, location.search, navigate])

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
				`/api/trellis/generations/${jobId}/artifact?token=${encodeURIComponent(jobToken)}`
			)
			const artifactBlob = await artifactResponse.blob()

			if (!artifactResponse.ok) {
				let message = 'Failed to download generated model.'
				try {
					const payload = JSON.parse(await artifactBlob.text()) as {
						error?: string
					}
					message = payload.error || message
				} catch {
					// ignore malformed error payloads
				}

				throw new Error(message)
			}

			const generatedModel = new File(
				[artifactBlob],
				`${imageFile.name.replace(/\.[^.]+$/, '') || 'generated-model'}.glb`,
				{ type: artifactBlob.type || 'model/gltf-binary' }
			)

			startTransition(async () => {
				await load([generatedModel] as InputFileOrDirectory)
			})
		},
		[load, startTransition]
	)

	const pollGeneration = useCallback(
		async (jobId: string, jobToken: string, imageFile: File) => {
			let nextPollDelay = 2500

			while (!isUnmountedRef.current) {
				await delay(nextPollDelay)

				const statusResponse = await fetch(
					`/api/trellis/generations/${jobId}?token=${encodeURIComponent(jobToken)}`
				)
				const statusData =
					await parseApiResponse<TrellisGenerationStatusResponse>(statusResponse)

				if (statusData.status === 'succeeded' && statusData.artifactReady) {
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

				setGenerationState({
					phase: statusData.status,
					progress: statusData.progress,
					message: getGenerationMessage(statusData.status, statusData.message),
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
				setGenerationState({
					phase: 'auth',
					progress: null,
					message: getGenerationMessage('auth'),
					imageFile,
					jobId: null,
					jobToken: null,
					retryable: false
				})
				redirectToSignIn()
				return
			}

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
				formData.append('image', imageFile)
				if (targetProjectId) {
					formData.append('targetProjectId', targetProjectId)
				}

				const submitResponse = await fetch('/api/trellis/generations', {
					method: 'POST',
					body: formData
				})

				if (submitResponse.status === 401) {
					setGenerationState({
						phase: 'auth',
						progress: null,
						message: getGenerationMessage('auth'),
						imageFile,
						jobId: null,
						jobToken: null,
						retryable: false
					})
					redirectToSignIn()
					return
				}

				const submitData =
					await parseApiResponse<TrellisGenerationSubmitResponse>(submitResponse)

				setGenerationState({
					phase: submitData.status,
					progress: submitData.status === 'queued' ? 15 : 25,
					message: getGenerationMessage(submitData.status),
					imageFile,
					jobId: submitData.jobId,
					jobToken: submitData.jobToken,
					retryable: false
				})

				await pollGeneration(
					submitData.jobId,
					submitData.jobToken,
					imageFile
				)
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
		[pollGeneration, redirectToSignIn, targetProjectId, userId]
	)

	const handleDrop = useCallback(
		(files: File[]) => {
			if (files.length === 0) {
				return
			}

			if (isImageOnlyDrop(files)) {
				if (files.length > 1) {
					setGenerationState({
						phase: 'failed',
						progress: null,
						message:
							'Image-to-3D generation currently supports a single image per job.',
						imageFile: files[0] ?? null,
						jobId: null,
						jobToken: null,
						retryable: false
					})
					return
				}

				void startImageGeneration(files[0] as File)
				return
			}

			resetGenerationState()

			startTransition(async () => {
				await load(files as InputFileOrDirectory)
			})
		},
		[load, resetGenerationState, startImageGeneration, startTransition]
	)

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleDrop
	})

	const { onClick, ...containerProps } = getRootProps<ComponentProps<'div'>>()

	const stopDropzoneTrigger = (event: SyntheticEvent) => {
		event.stopPropagation()
	}

	const handleImageButtonClick = useCallback(
		(event: SyntheticEvent) => {
			stopDropzoneTrigger(event)
			if (!userId) {
				setGenerationState({
					phase: 'auth',
					progress: null,
					message: getGenerationMessage('auth'),
					imageFile: null,
					jobId: null,
					jobToken: null,
					retryable: false
				})
				redirectToSignIn()
				return
			}

			imageInputRef.current?.click()
		},
		[redirectToSignIn, userId]
	)

	const handleImageInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const selectedFile = event.target.files?.[0]
			event.currentTarget.value = ''

			if (!selectedFile) {
				return
			}

			void startImageGeneration(selectedFile)
		},
		[startImageGeneration]
	)

	const handleRetryGeneration = useCallback(() => {
		if (!generationState.imageFile) {
			return
		}

		void startImageGeneration(generationState.imageFile)
	}, [generationState.imageFile, startImageGeneration])

	const renderGenerationState = () => (
		<div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
			<div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
				{generationState.phase === 'failed' || generationState.phase === 'auth' ? (
					<ImagePlus className="text-muted-foreground h-10 w-10" />
				) : (
					<LoadingSpinner className="h-10 w-10" />
				)}
			</div>
			<div className="space-y-2">
				<h2 className="text-xl! font-semibold md:text-2xl!">
					{generationState.phase === 'failed'
						? 'Generation Needs Attention'
						: generationState.phase === 'auth'
							? 'Sign In Required'
							: 'Generating Your 3D Model'}
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					{generationState.message}
				</p>
			</div>
			{typeof generationState.progress === 'number' && (
				<div className="w-full space-y-2">
					<Progress value={generationState.progress} />
					<p className="text-muted-foreground text-xs">
						{Math.round(generationState.progress)}% complete
					</p>
				</div>
			)}
			<div className="flex flex-col gap-2 sm:flex-row">
				{generationState.phase === 'failed' && generationState.retryable ? (
					<Button
						onClick={(event) => {
							stopDropzoneTrigger(event)
							void handleRetryGeneration()
						}}
					>
						Retry Generation
					</Button>
				) : null}
				{generationState.phase === 'auth' ? (
					<Button
						onClick={(event) => {
							stopDropzoneTrigger(event)
							redirectToSignIn()
						}}
					>
						Sign In to Continue
					</Button>
				) : null}
				<Button
					variant="ghost"
					onClick={(event) => {
						stopDropzoneTrigger(event)
						resetGenerationState()
					}}
				>
					Choose Something Else
				</Button>
			</div>
		</div>
	)

	const renderDefaultDropState = () => (
		<>
			<div
				className={cn(
					'bg-muted/50 mb-6 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300',
					isDragActive ? 'bg-accent' : ''
				)}
			>
				<FolderUp
					className={cn(
						'h-10 w-10 transition-all duration-300',
						isDragActive ? 'text-primary' : 'text-muted-foreground'
					)}
				/>
			</div>

			<h2 className="mb-2 text-xl! font-semibold md:text-2xl!">
				{isDragActive
					? 'Drop Your Files to Get Started'
					: 'Drop a 3D Model or a Single Image'}
			</h2>

			<p className="text-muted-foreground mb-6 max-w-md text-center">
				3D uploads stay local until you save. Image generation runs through
				the Trellis runtime after you sign in.
			</p>

			<div className="flex flex-col gap-2 sm:flex-row">
				<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
					<Upload className="h-4 w-4" />
					Choose 3D Files
				</Button>
				<Button
					variant="secondary"
					className="flex items-center gap-2 transition-all duration-300"
					onClick={handleImageButtonClick}
				>
					<ImagePlus className="h-4 w-4" />
					Generate from Image
				</Button>
			</div>
			<p className="text-muted-foreground mt-2 max-w-sm text-center text-xs">
				Image-to-3D currently supports one PNG, JPEG, or WebP reference image
				per job.
			</p>
		</>
	)

	const renderCardState = () => {
		if (isLoading && generationState.phase === 'idle') {
			return (
				<div className="flex flex-col items-center justify-center gap-3">
					<LoadingSpinner className="h-10 w-10" />
					<p className="text-muted-foreground text-sm">
						{isPending ? 'Processing files...' : 'Preparing Publisher...'}
					</p>
				</div>
			)
		}

		if (generationState.phase !== 'idle') {
			return renderGenerationState()
		}

		return renderDefaultDropState()
	}

	return (
		<div className="h-full w-full">
			<div
				{...containerProps}
				className="flex h-full w-full flex-col items-center justify-center gap-4 text-center"
			>
				<div className="w-full max-w-6xl p-4">
					<header className="mb-8 text-left">
						<p className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.22em] uppercase">
							Publisher
						</p>
						<h1 className="max-w-4xl text-4xl leading-[1.02] font-medium tracking-tight text-balance md:text-6xl">
							Upload 3D Assets or Generate from an Image
						</h1>
						<p className="text-muted-foreground mt-2 max-w-3xl text-base leading-relaxed md:text-lg">
							Drop a model bundle to optimize it for the web, or use a single
							image to start an async Trellis 3D generation job.
						</p>
					</header>
					<div className="flex flex-col gap-4">
						{/* <div className="flex flex-col gap-4 md:flex-row lg:grid lg:grid-cols-[2fr_1fr]"> */}
						<div className="flex h-full flex-col gap-4" onClick={onClick}>
							{isMobile ? (
								generationState.phase !== 'idle' ? (
									<BasicCard highlight>
										<div className="relative flex h-full flex-col items-center justify-center rounded-lg p-4 transition-all duration-300">
											{renderGenerationState()}
										</div>
									</BasicCard>
								) : (
									<div className="flex flex-col gap-2">
										<Button
											className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300"
											disabled={isLoading}
										>
											{isLoading ? (
												<LoadingSpinner className="h-4 w-4" />
											) : (
												<Upload className="h-4 w-4" />
											)}
											{isLoading ? 'Processing...' : 'Choose 3D Files'}
										</Button>
										<Button
											variant="secondary"
											className="flex items-center gap-2"
											onClick={handleImageButtonClick}
										>
											<ImagePlus className="h-4 w-4" />
											Generate from Image
										</Button>
									</div>
								)
							) : (
								<BasicCard highlight>
									<div
										className={cn(
											'relative flex h-full flex-col items-center justify-center rounded-lg p-4 transition-all duration-300',
											isDragActive && !isLoading
												? 'scale-[0.98] opacity-90'
												: 'scale-100'
										)}
									>
										{renderCardState()}
									</div>
								</BasicCard>
							)}
							<div
								className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center"
								onClick={stopDropzoneTrigger}
								onPointerDown={stopDropzoneTrigger}
							>
								<Button
									variant="ghost"
									asChild
									className="hover:bg-accent/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs/getting-started/first-model" viewTransition>
										<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
											<Book className="h-4 w-4" />
										</div>
										<div className="text-left">
											<div className="font-medium">Your First Model Guide</div>
											<div className="text-muted-foreground text-xs">
												Step-by-step upload to publish walkthrough
											</div>
										</div>
									</Link>
								</Button>

								<Button
									variant="ghost"
									asChild
									className="hover:bg-accent/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs/guides/upload" viewTransition>
										<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
											<FileQuestion className="h-4 w-4" />
										</div>
										<div className="text-left">
											<div className="font-medium">Upload Format Guide</div>
											<div className="text-muted-foreground text-xs">
												Supported file types, bundles, and tips
											</div>
										</div>
									</Link>
								</Button>

								<Button
									variant="ghost"
									asChild
									className="hover:bg-accent/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs" viewTransition>
										<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
											<ExternalLink className="h-4 w-4" />{' '}
										</div>
										<div className="text-left">
											<div className="font-medium">Documentation Hub</div>
											<div className="text-muted-foreground text-xs">
												Full guides, package references, and deployment docs
											</div>
										</div>
									</Link>
								</Button>
							</div>
						</div>
						{/* <div className="flex flex-col gap-6">
							<BasicCard className="py-0 text-left">
								<CardContent className="space-y-4 p-4">
									<div className="space-y-3">
										<div className="flex items-center gap-3">
											<File className="text-accent/75 h-5 w-5" />
											<h3 className="text-lg! font-medium">3D Files</h3>
										</div>
										<ul className="text-muted-foreground list-disc space-y-2 pl-4 text-sm">
											<li>glTF / GLB (recommended)</li>
											<li>USDZ for Apple AR</li>
											<li>OBJ with textures</li>
										</ul>
									</div>

									<div className="space-y-3">
										<div className="flex items-center gap-3">
											<Image className="text-accent/75 h-5 w-5" />
											<h3 className="text-lg! font-medium">Textures</h3>
										</div>
										<ul className="text-muted-foreground list-disc space-y-2 pl-4 text-sm">
											<li>PNG (with transparency)</li>
											<li>JPG (compressed)</li>
											<li>WEBP (modern format)</li>
										</ul>
									</div>
									{!isMobile && (
										<>
											<div className="space-y-3">
												<div className="flex items-center gap-3">
													<UserX2 className="text-accent/75 h-5 w-5" />
													<h3 className="text-lg! font-medium">
														No Registration Required
													</h3>
												</div>

												<p className="text-muted-foreground text-sm">
													Process your files locally - no account needed until
													you're ready to publish
												</p>
											</div>
											<div className="space-y-3">
												<div className="flex items-center gap-3">
													<Rocket className="text-accent/75 h-5 w-5" />
													<h3 className="text-lg! font-medium">
														Instant Publishing
													</h3>
												</div>

												<p className="text-muted-foreground text-sm">
													Share your optimized 3D content directly through
													Vectreal when ready
												</p>
											</div>
										</>
									)}
								</CardContent>
							</BasicCard>
						</div> */}
					</div>
				</div>

				<input
					{...getInputProps()}
					webkitdirectory="true"
					directory="true"
					multiple
					accept={acceptPattern}
				/>
				<input
					ref={imageInputRef}
					className="hidden"
					type="file"
					accept={IMAGE_ACCEPT}
					onChange={handleImageInputChange}
				/>
			</div>
		</div>
	)
}
