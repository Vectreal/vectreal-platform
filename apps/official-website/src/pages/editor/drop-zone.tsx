import { useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { PlusIcon } from '@radix-ui/react-icons'

import { useModelContext } from '@vctrl/hooks/use-load-model'
import { Card, CardContent } from '@vctrl/shared/components'

import TypographyLead from '../../components/typography/typography-lead'
import { useAcceptPattern } from '../../lib/hooks'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		// extends React's HTMLAttributes
		directory?: string
		webkitdirectory?: string
	}
}

const DropZone = () => {
	const acceptPattern = useAcceptPattern()
	const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
		useDropzone()

	const { load } = useModelContext()

	useEffect(() => {
		if (acceptedFiles.length > 0) {
			load(acceptedFiles)
		}
	}, [acceptedFiles, load])

	const easeTransition = 'transition ease-in-out duration-300'
	const shadow = isDragActive
		? 'shadow-xl border-zinc-500'
		: 'shadow-s border-zinc-800'

	return (
		<div className="h-full w-full p-4 pt-16 pb-4">
			<Card
				className={`h-full w-full border-2 border-dashed p-6 ${shadow} ${easeTransition} filter-drop-shadow bg-transparent`}
			>
				<CardContent className="h-full w-full p-0">
					<div
						{...getRootProps({
							className: `w-full h-full flex flex-col items-center justify-center gap-4 text-center`
						})}
					>
						<PlusIcon className="mb-6 h-16 w-16 text-zinc-300" />
						<TypographyLead isHighlighted={isDragActive}>
							Click here, or drag and drop your 3D model files
						</TypographyLead>
						<input
							{...getInputProps()}
							// webkitdirectory="true"
							directory="true"
							multiple
							accept={acceptPattern}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default DropZone
