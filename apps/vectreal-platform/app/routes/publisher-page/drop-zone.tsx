import { useAcceptPattern } from '@shared/components/hooks/use-accept-pattern'
import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { Progress } from '@shared/components/ui/progress'
import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Book, ExternalLink, FileQuestion, FolderUp, ImagePlus, Upload } from 'lucide-react'
import {
	type ChangeEvent,
	type ComponentProps,
	type SyntheticEvent,
	useCallback,
	useRef,
	useTransition
} from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useNavigation } from 'react-router'

import { useImgTo3dGeneration } from './use-img-to-3d-generation'
import BasicCard from '../../components/layout-components/basic-card'

import type { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		directory?: string
		webkitdirectory?: string
	}
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_IMAGES_PER_JOB = 1

// ---------------------------------------------------------------------------
// File classification helpers
// ---------------------------------------------------------------------------

function isSupportedImageFile(file: File): boolean {
	return IMAGE_MIME_TYPES.has(file.type)
}

function isImageOnlyDrop(files: File[]): boolean {
	return files.length > 0 && files.every(isSupportedImageFile)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
	isMobile?: boolean
	targetProjectId?: string
	userId?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DropZone = ({ isMobile, targetProjectId, userId }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)
	const { load } = useModelContext()
	const [isDirectLoadPending, startDirectLoad] = useTransition()
	const navigation = useNavigation()
	const imageInputRef = useRef<HTMLInputElement | null>(null)

	const generation = useImgTo3dGeneration({ userId, targetProjectId })

	const isNavigationLoading =
		navigation.state === 'loading' &&
		Boolean(navigation.location?.pathname?.startsWith('/publisher'))

	const isLoading =
		isDirectLoadPending ||
		generation.isPending ||
		isNavigationLoading ||
		generation.isGenerating

	const stopDropzoneTrigger = (event: SyntheticEvent) => {
		event.stopPropagation()
	}

	const handleDrop = useCallback(
		(files: File[]) => {
			if (files.length === 0) return

			if (isImageOnlyDrop(files)) {
				if (files.length > MAX_IMAGES_PER_JOB) {
					generation.setGenerationError(
						'Image-to-3D generation currently supports a single image per job.',
						files[0] ?? null
					)
					return
				}

				generation.startImageGeneration(files[0] as File)
				return
			}

			generation.resetGenerationState()
			startDirectLoad(async () => {
				await load(files as InputFileOrDirectory)
			})
		},
		[load, startDirectLoad, generation]
	)

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleDrop,
		disabled: isLoading
	})
	const { onClick, ...containerProps } = getRootProps<ComponentProps<'div'>>()

	const handleImageButtonClick = useCallback(
		(event: SyntheticEvent) => {
			stopDropzoneTrigger(event)
			if (isLoading) return
			if (!userId) {
				generation.requireSignIn()
				return
			}
			imageInputRef.current?.click()
		},
		[isLoading, generation, userId]
	)

	const handleImageInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const selectedFile = event.target.files?.[0]
			event.currentTarget.value = ''
			if (!selectedFile) return
			generation.startImageGeneration(selectedFile)
		},
		[generation]
	)

	// ---------------------------------------------------------------------------
	// Render helpers
	// ---------------------------------------------------------------------------

	const { generationState } = generation
	const { phase } = generationState

	const renderGenerationState = () => (
		<div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
			<div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
				{phase === 'failed' || phase === 'auth' ? (
					<ImagePlus className="text-muted-foreground h-10 w-10" />
				) : (
					<LoadingSpinner className="h-10 w-10" />
				)}
			</div>
			<div className="space-y-2">
				<h2 className="text-xl! font-semibold md:text-2xl!">
					{phase === 'failed'
						? 'Generation Needs Attention'
						: phase === 'auth'
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
				{phase === 'failed' && generationState.retryable ? (
					<Button
						onClick={(event) => {
							stopDropzoneTrigger(event)
							generation.retryGeneration()
						}}
					>
						Retry Generation
					</Button>
				) : null}
				{phase === 'auth' ? (
					<Button
						onClick={(event) => {
							stopDropzoneTrigger(event)
							generation.requireSignIn()
						}}
					>
						Sign In to Continue
					</Button>
				) : null}
				<Button
					variant="ghost"
					onClick={(event) => {
						stopDropzoneTrigger(event)
						generation.resetGenerationState()
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
				3D uploads stay local until you save. Image generation runs through the
				cloud runtime after you sign in.
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

	const renderCardContent = () => {
		if (isLoading && phase === 'idle') {
			return (
				<div className="flex flex-col items-center justify-center gap-3">
					<LoadingSpinner className="h-10 w-10" />
					<p className="text-muted-foreground text-sm">
						{isDirectLoadPending ? 'Processing files...' : 'Preparing Publisher...'}
					</p>
				</div>
			)
		}

		if (phase !== 'idle') return renderGenerationState()

		return renderDefaultDropState()
	}

	const renderDocLinks = () => (
		<div
			className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center"
			onClick={stopDropzoneTrigger}
			onPointerDown={stopDropzoneTrigger}
		>
			{[
				{
					to: '/docs/getting-started/first-model',
					icon: <Book className="h-4 w-4" />,
					title: 'Your First Model Guide',
					description: 'Step-by-step upload to publish walkthrough'
				},
				{
					to: '/docs/guides/upload',
					icon: <FileQuestion className="h-4 w-4" />,
					title: 'Upload Format Guide',
					description: 'Supported file types, bundles, and tips'
				},
				{
					to: '/docs',
					icon: <ExternalLink className="h-4 w-4" />,
					title: 'Documentation Hub',
					description: 'Full guides, package references, and deployment docs'
				}
			].map(({ to, icon, title, description }) => (
				<Button
					key={to}
					variant="ghost"
					asChild
					className="hover:bg-accent/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
				>
					<Link to={to} viewTransition>
						<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
							{icon}
						</div>
						<div className="text-left">
							<div className="font-medium">{title}</div>
							<div className="text-muted-foreground text-xs">{description}</div>
						</div>
					</Link>
				</Button>
			))}
		</div>
	)

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

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
							image to start an async image-to-3D generation job.
						</p>
					</header>
					<div className="flex flex-col gap-4">
						<div className="flex h-full flex-col gap-4" onClick={onClick}>
							{isMobile ? (
								phase !== 'idle' ? (
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
										{renderCardContent()}
									</div>
								</BasicCard>
							)}
							{renderDocLinks()}
						</div>
					</div>
				</div>

				<input
					{...getInputProps()}
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
