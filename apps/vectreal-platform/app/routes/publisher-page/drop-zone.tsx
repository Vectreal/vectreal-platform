import { useAcceptPattern } from '@shared/components/hooks/use-accept-pattern'
import { Button } from '@shared/components/ui/button'
import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import {
	Book,
	ExternalLink,
	FileQuestion,
	FolderUp,
	Upload
} from 'lucide-react'
import {
	ComponentProps,
	SyntheticEvent,
	useCallback,
	useTransition
} from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useNavigation } from 'react-router'

import BasicCard from '../../components/layout-components/basic-card'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		// extends React's HTMLAttributes
		directory?: string
		webkitdirectory?: string
	}
}

interface Props {
	isMobile?: boolean
}

export const DropZone = ({ isMobile }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)
	const { load } = useModelContext()

	const [isPending, startTransition] = useTransition()
	const navigation = useNavigation()

	// Show a loading state when files are being processed or when navigating
	// within the publisher (e.g. to a newly created scene route).
	const isNavigationLoading =
		navigation.state === 'loading' &&
		Boolean(navigation.location?.pathname?.startsWith('/publisher'))

	const isLoading = isPending || isNavigationLoading

	const handleDrop = useCallback(
		(files: File[]) => {
			if (files.length === 0) {
				return
			}

			startTransition(async () => {
				await load(files as InputFileOrDirectory)
			})
		},
		[load, startTransition]
	)

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleDrop
	})

	const { onClick, ...containerProps } = getRootProps<ComponentProps<'div'>>()

	const stopDropzoneTrigger = (event: SyntheticEvent) => {
		event.stopPropagation()
	}

	return (
		<div className="h-full w-full">
			<div
				{...containerProps}
				className="flex h-full w-full flex-col items-center justify-center gap-4 text-center"
			>
				<div className="w-full max-w-6xl p-4">
					<header className="mb-8 flex items-center justify-between text-left">
						<div>
							<h1 className="text-4xl tracking-tight">Upload Your 3D Assets</h1>
							<p className="text-muted-foreground mt-2">
								Drop your files here to optimize them for web and AR viewing
							</p>
						</div>
					</header>
					<div className="flex flex-col gap-4">
						{/* <div className="flex flex-col gap-4 md:flex-row lg:grid lg:grid-cols-[2fr_1fr]"> */}
						<div className="flex h-full flex-col gap-4" onClick={onClick}>
							{isMobile ? (
								<Button
									className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300"
									disabled={isLoading}
								>
									{isLoading ? (
										<LoadingSpinner className="h-4 w-4" />
									) : (
										<Upload className="h-4 w-4" />
									)}
									{isLoading ? 'Processing...' : 'Choose Files'}
								</Button>
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
										{isLoading ? (
											<div className="flex flex-col items-center justify-center gap-3">
												<LoadingSpinner className="h-10 w-10" />
												<p className="text-muted-foreground text-sm">
													{isPending
														? 'Processing files...'
														: 'Preparing Publisher...'}
												</p>
											</div>
										) : (
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
															isDragActive
																? 'text-primary'
																: 'text-muted-foreground'
														)}
													/>
												</div>

												<h2 className="mb-2 text-xl! font-semibold md:text-2xl!">
													{isDragActive
														? 'Drop to Start Processing'
														: 'Drop Your 3D Files Anywhere'}
												</h2>

												<p className="text-muted-foreground mb-6 max-w-md text-center">
													Your files stay on your device until you choose to
													publish
												</p>

												<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
													<Upload className="h-4 w-4" />
													Choose Files
												</Button>
											</>
										)}
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
			</div>
		</div>
	)
}
