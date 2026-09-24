import { useModelFileInputs } from '@shared/components/hooks/use-model-file-inputs'
import { Button } from '@shared/components/ui/button'
import { Card } from '@shared/components/ui/card'
import { cn } from '@shared/utils'
import { BUNDLE_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
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
	useEffect,
	useRef
} from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { useAcceptPattern } from '../../../hooks/use-accept-pattern'
import {
	fetchSampleModel,
	PUBLISHER_SAMPLE_PARAM,
	sampleModelById
} from '../../../lib/samples/sample-models'
import { SampleTiles } from '../../layout-components/sample-tiles'

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
/*
  Which formats arrive as a folder rather than a file, read from the owner.

  This line used to name `.gltf` alone, and OBJ became a bundle in the same
  changeset that made it importable - so an OBJ dropped here on its own lost its
  materials and came back grey, while the sentence above the button said nothing
  about it. `isBundle` is a property of the format, so the sentence is derived
  from it rather than maintained beside it: the next bundle appears here on the
  day it is declared.
*/
const BUNDLE_HINT = `A ${BUNDLE_FORMAT_IDS.map(
	(id) => `.${modelFormat(id).extension}`
).join(' or ')} needs the folder holding everything it points at`

export const DropZone = ({ isMobile, onUpload }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)

	/* `useModelFileInputs` owns why there are two of these. */
	const {
		fileInputRef,
		directoryInputRef,
		inputProps,
		openFilePicker,
		openDirectoryPicker
	} = useModelFileInputs((files) => {
		void onUpload(files as InputFileOrDirectory)
	})

	const handleDrop = useCallback(
		(files: File[]) => {
			if (files.length === 0) {
				return
			}

			void onUpload(files as InputFileOrDirectory)
		},
		[onUpload]
	)

	const openSample = useCallback(
		async (id: string) => {
			const sample = sampleModelById(id)
			if (!sample) return

			try {
				await onUpload([await fetchSampleModel(sample)] as InputFileOrDirectory)
			} catch {
				toast.error(
					'The sample could not be opened. Try your own file instead.'
				)
			}
		},
		[onUpload]
	)

	/*
	  A link can name a sample (`publisherSampleHref`), for someone arriving from
	  a page that showed them one. The param is taken off the URL as the sample
	  opens, so a reload lands here empty rather than downloading it again. The
	  ref is for StrictMode, which mounts this twice and would open it twice.
	*/
	const [searchParams, setSearchParams] = useSearchParams()
	const linkedSample = searchParams.get(PUBLISHER_SAMPLE_PARAM)
	const openedLinkedSample = useRef(false)
	useEffect(() => {
		if (!linkedSample || openedLinkedSample.current) return
		openedLinkedSample.current = true
		setSearchParams(
			(params) => {
				params.delete(PUBLISHER_SAMPLE_PARAM)
				return params
			},
			{ replace: true, preventScrollReset: true }
		)
		void openSample(linkedSample)
	}, [linkedSample, openSample, setSearchParams])

	const { getRootProps, isDragActive } = useDropzone({ onDrop: handleDrop })

	/*
	  The container keeps the drag handlers and loses the click. Dropzone's own
	  click opens the input it manages; the two below are opened by name, so a
	  click on the card means the common case rather than whichever input
	  happened to be rendered.
	*/
	const { onClick: _dropzoneClick, ...containerProps } =
		getRootProps<ComponentProps<'div'>>()

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
						<div
							className="flex h-full flex-col gap-4"
							onClick={openFilePicker}
						>
							{isMobile ? (
								/*
								  No folder option here. iOS and Android have no directory
								  picker to open, so offering one would be a button that does
								  nothing on the devices this branch exists for.

								  The samples do belong here, and were missed when they were
								  added: this branch is the entire publisher for a phone, so
								  leaving them in the desktop card meant the people least
								  likely to have a .glb to hand were the only ones never
								  offered one.
								*/
								<div className="flex flex-col items-start gap-6">
									<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
										<Upload className="h-4 w-4" />
										Choose a file
									</Button>

									<SampleTiles
										className="w-full text-left"
										label="Nothing to hand?"
										onOpen={(id) => void openSample(id)}
										onBeforeOpen={stopDropzoneTrigger}
									/>
								</div>
							) : (
								<Card className="group ds-overlay relative h-full overflow-hidden rounded-2xl">
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
														? 'text-foreground'
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
											Choose a file
										</Button>

										{/*
										  The second shape, named for when it applies rather than
										  as an equal alternative. A reader with a `.glb` never
										  needs this; a reader with a `.gltf` cannot proceed
										  without it, and nothing else on this screen would tell
										  them so.
										*/}
										<button
											type="button"
											onClick={(event) => {
												stopDropzoneTrigger(event)
												openDirectoryPicker()
											}}
											className="text-muted-foreground hover:text-foreground mt-3 text-sm underline underline-offset-4"
										>
											Choose a folder instead
										</button>
										<p className="text-muted-foreground mt-1 text-xs">
											{BUNDLE_HINT}
										</p>

										{/*
										  Something to open when you have nothing to open.

										  The publisher's whole value is visible only with a model
										  in it, and until now the only way to see any of it was to
										  already have one - which is a poor trade for someone
										  deciding whether this is worth their file. Two models
										  rather than one, because the optimization passes do
										  different jobs: the rocket is two thirds geometry and the
										  camera is nearly all texture, nine 4K images, so each one
										  makes a different pass look like it is working. The split
										  is measured; see `sample-models.ts`.
										*/}
										<SampleTiles
											className="mt-8 w-full max-w-md"
											label="Nothing to hand?"
											onOpen={(id) => void openSample(id)}
											onBeforeOpen={stopDropzoneTrigger}
										/>
									</div>
								</Card>
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

				{/*
				  `multiple` on the file input as well, so someone who keeps a `.gltf`
				  beside its `.bin` and textures can select them together without
				  reaching for the folder picker at all.
				*/}
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept={acceptPattern}
					{...inputProps}
					className="hidden"
					tabIndex={-1}
					aria-hidden="true"
				/>
				<input
					ref={directoryInputRef}
					type="file"
					webkitdirectory="true"
					directory="true"
					multiple
					{...inputProps}
					className="hidden"
					tabIndex={-1}
					aria-hidden="true"
				/>
			</div>
		</div>
	)
}
