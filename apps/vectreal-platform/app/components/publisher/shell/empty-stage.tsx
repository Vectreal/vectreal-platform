import { useModelFileInputs } from '@shared/components/hooks/use-model-file-inputs'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { BUNDLE_FORMAT_IDS, modelFormat } from '@vctrl/core/model-formats'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import { FolderUp, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { useAcceptPattern } from '../../../hooks/use-accept-pattern'
import { type SampleDownloader } from '../../../hooks/use-sample-download'
import { PUBLISHER_SAMPLE_PARAM } from '../../../lib/samples/sample-models'
import { DitherGrain } from '../../layout-components/dither-grain'
import { SampleTiles } from '../../layout-components/sample-tiles'

interface Props {
	isMobile?: boolean
	/** Loads the dropped files and takes care of everything a new scene needs. */
	onUpload: (files: InputFileOrDirectory) => Promise<unknown>
	/**
	 * The sample download, owned by the shell rather than by this stage. A link
	 * that names a sample takes the param off the URL, and that navigation
	 * revalidates the publisher, which shows its loading surface and unmounts
	 * this one while the download runs on. Held in here, the state went with it
	 * and the tiles came back idle and clickable halfway through 18 MB.
	 */
	sampleDownload: SampleDownloader
}

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

/**
 * The publisher's stage with nothing on it yet.
 *
 * It is the editor, under the editor's own header, rather than a page of its
 * own. It used to be a separate screen under the site nav, with a marketing
 * heading and three docs buttons, and dropping a file swapped the whole page
 * for the editor without navigating; the nav then had to be hidden at runtime,
 * after paint.
 *
 * The whole stage takes a drop, as the converter's does. The welcome panel is
 * not a dialog: a dialog would trap focus and catch the drop on a page with
 * nothing else on it.
 */
export const EmptyStage = ({ isMobile, onUpload, sampleDownload }: Props) => {
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

	const { download, openSample: downloadSample } = sampleDownload
	const openSample = useCallback(
		async (id: string) => {
			try {
				await downloadSample(id, (file) =>
					onUpload([file] as InputFileOrDirectory)
				)
			} catch {
				toast.error(
					'The sample could not be opened. Try your own file instead.'
				)
			}
		},
		[downloadSample, onUpload]
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

	/*
	  No click and no keyboard: the buttons below open the picker by name, so a
	  click anywhere on the stage is not an upload, and `multiple` because a
	  `.gltf` arrives with its `.bin` and textures.
	*/
	const { getRootProps, isDragActive } = useDropzone({
		onDrop: handleDrop,
		multiple: true,
		noClick: true,
		noKeyboard: true
	})

	return (
		<section
			// react-dropzone makes its root `presentation` unless told otherwise, which drops the label too.
			{...getRootProps({ role: 'region' })}
			aria-label="Empty stage"
			className={cn(
				'relative isolate flex h-full w-full items-center justify-center overflow-hidden p-4 transition-shadow',
				isDragActive && 'ring-2 ring-[rgb(var(--orange-rgb))] ring-inset'
			)}
		>
			<DitherGrain origin="right" />

			<div className="ds-overlay w-full max-w-md rounded-2xl p-6 sm:p-8">
				<h1 className="text-h3">
					{isDragActive ? 'Drop to open it' : 'Drop a 3D file anywhere'}
				</h1>
				<p className="text-muted-foreground text-body-sm mt-2">
					It opens right here in your browser, and nothing leaves your device
					until you save.
				</p>

				<div className="mt-6 flex flex-wrap items-center gap-2">
					<Button onClick={openFilePicker}>
						<Upload className="h-4 w-4" aria-hidden />
						Choose a file
					</Button>
					{/*
					  No folder option on a phone. iOS and Android have no directory
					  picker to open, so offering one would be a button that does
					  nothing on the devices this branch exists for.
					*/}
					{!isMobile && (
						<Button variant="outline" onClick={openDirectoryPicker}>
							<FolderUp className="h-4 w-4" aria-hidden />
							Choose a folder
						</Button>
					)}
				</div>
				{!isMobile && (
					<p className="text-muted-foreground mt-3 text-xs">{BUNDLE_HINT}</p>
				)}

				{/*
				  Something to open when you have nothing to open. Two models rather
				  than one, because the optimization passes do different jobs: the
				  rocket is two thirds geometry and the camera is nearly all texture,
				  so each one makes a different pass look like it is working. The
				  split is measured; see `sample-models.ts`.
				*/}
				<SampleTiles
					className="mt-8"
					label="Or open a sample"
					onOpen={(id) => void openSample(id)}
					download={download}
				/>

				<Link
					to="/docs/getting-started"
					className="text-muted-foreground hover:text-foreground mt-6 inline-block text-sm underline underline-offset-4"
				>
					How the publisher works
				</Link>
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
		</section>
	)
}
