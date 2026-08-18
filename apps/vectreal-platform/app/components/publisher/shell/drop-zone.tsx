import { useAcceptPattern } from '@shared/components/hooks/use-accept-pattern'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import {
	Book,
	ExternalLink,
	FileQuestion,
	FolderUp,
	Upload
} from 'lucide-react'
import { ComponentProps, SyntheticEvent, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link } from 'react-router'

import BasicCard from '../../layout-components/basic-card'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		// extends React's HTMLAttributes
		directory?: string
		webkitdirectory?: string
	}
}

interface Props {
	isMobile?: boolean
	/** Loads the dropped files and takes care of everything a new scene needs. */
	onUpload: (files: InputFileOrDirectory) => Promise<unknown>
}

/**
 * The publisher with nothing in it yet.
 *
 * One of the surfaces `resolvePublisherSurface` picks between, which is why it
 * sits beside the others rather than in the route: the shell decides what is on
 * screen, and a load in flight is the shell's loading surface, not a spinner in
 * here.
 */
export const DropZone = ({ isMobile, onUpload }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)

	const handleDrop = useCallback(
		(files: File[]) => {
			if (files.length === 0) {
				return
			}

			void onUpload(files as InputFileOrDirectory)
		},
		[onUpload]
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
					<header className="mb-8 text-left">
						<p className="text-eyebrow text-muted-foreground mb-2">Publisher</p>
						<h1 className="text-headline max-w-4xl">Upload Your 3D Assets</h1>
						<p className="text-body-lg text-muted-foreground mt-2 max-w-3xl">
							Drop your files here to optimize them for web and AR viewing
						</p>
					</header>
					<div className="flex flex-col gap-4">
						{/* <div className="flex flex-col gap-4 md:flex-row lg:grid lg:grid-cols-[2fr_1fr]"> */}
						<div className="flex h-full flex-col gap-4" onClick={onClick}>
							{isMobile ? (
								<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
									<Upload className="h-4 w-4" />
									Choose Files
								</Button>
							) : (
								<BasicCard highlight>
									<div
										className={cn(
											'relative flex h-full flex-col items-center justify-center rounded-lg p-4 transition-all duration-300',
											isDragActive ? 'scale-[0.98] opacity-90' : 'scale-100'
										)}
									>
										<div
											className={cn(
												'bg-muted/50 mb-6 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300',
												isDragActive ? 'bg-orange' : ''
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

										{/*
										  No `!` flags here. They dated from when the app's
										  unlayered CSS-module heading rules beat every Tailwind
										  size; those defaults now live in `base` and lose to any
										  utility the markup asks for.
										*/}
										<h2 className="text-h3 mb-2">
											{isDragActive
												? 'Drop to Start Processing'
												: 'Drop Your 3D Files Anywhere'}
										</h2>

										<p className="text-muted-foreground mb-6 max-w-md text-center">
											Your files stay on your device until you choose to publish
										</p>

										<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
											<Upload className="h-4 w-4" />
											Choose Files
										</Button>
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
									className="hover:bg-orange/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs/getting-started/first-model" viewTransition>
										<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
											<Book className="h-4 w-4" />
										</div>
										<div className="text-left">
											<div className="text-h4">Your First Model Guide</div>
											<div className="text-label-xs text-muted-foreground">
												Step-by-step upload to publish walkthrough
											</div>
										</div>
									</Link>
								</Button>

								<Button
									variant="ghost"
									asChild
									className="hover:bg-orange/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs/guides/upload" viewTransition>
										<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md">
											<FileQuestion className="h-4 w-4" />
										</div>
										<div className="text-left">
											<div className="text-h4">Upload Format Guide</div>
											<div className="text-label-xs text-muted-foreground">
												Supported file types, bundles, and tips
											</div>
										</div>
									</Link>
								</Button>

								<Button
									variant="ghost"
									asChild
									className="hover:bg-orange/50 flex h-auto w-full grow items-center justify-start gap-3 rounded-xl p-3"
								>
									<Link to="/docs" viewTransition>
										<div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
											<ExternalLink className="h-4 w-4" />{' '}
										</div>
										<div className="overflow-hidden text-left">
											<div className="text-h4">Documentation Hub</div>
											<div className="text-label-xs text-muted-foreground whitespace-break-spaces">
												Full guides, package references, and deployment docs
											</div>
										</div>
									</Link>
								</Button>
							</div>
						</div>
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
