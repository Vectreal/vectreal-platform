import { useModelContext } from '@vctrl/hooks/use-load-model'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import { useAcceptPattern } from '@vctrl-ui/hooks/use-accept-pattern'
import { cn } from '@vctrl-ui/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useTransition } from 'react'
import { useDropzone } from 'react-dropzone'

declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		// extends React's HTMLAttributes
		directory?: string
		webkitdirectory?: string
	}
}

interface Props extends React.PropsWithChildren {
	isMobile?: boolean
}

const DropZone = ({ children, isMobile }: Props) => {
	const acceptPattern = useAcceptPattern(isMobile)
	const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
		useDropzone()
	const { load } = useModelContext()

	const [, startTransition] = useTransition()

	useEffect(() => {
		if (acceptedFiles.length > 0) {
			startTransition(async () => {
				// load the files
				await load(acceptedFiles as InputFileOrDirectory)
			})
		}
	}, [acceptedFiles, load])

	return (
		<div className="h-full w-full cursor-pointer pt-12 opacity-80 transition-all duration-500 hover:opacity-100">
			<div
				{...getRootProps({
					className: cn(
						'w-full h-full flex  flex-col items-center transition-all duration-500 justify-center gap-4 text-center',
						isDragActive && 'scale-105'
					)
				})}
			>
				{children}
				<input
					{...getInputProps()}
					// webkitdirectory="true"
					directory="true"
					multiple
					accept={acceptPattern}
				/>
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0, display: 'none' }}
						animate={{
							opacity: isDragActive ? 1 : 0,
							display: isDragActive ? 'block' : 'none'
						}}
						exit={{ opacity: 0, display: 'none' }}
						transition={{ duration: 0.8 }}
						key="dropzone"
						className={cn(
							'bg-primary/5 absolute -z-10 mx-auto my-auto h-2/4 w-2/4 animate-pulse rounded-full blur-3xl transition-opacity'
						)}
					/>
				</AnimatePresence>
			</div>
		</div>
	)
}

export default DropZone
