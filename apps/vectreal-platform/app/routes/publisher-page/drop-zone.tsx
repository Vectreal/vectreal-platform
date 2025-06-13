import { useModelContext } from '@vctrl/hooks/use-load-model'
import { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'
import { useAcceptPattern } from '@vctrl-ui/hooks/use-accept-pattern'
import { Button } from '@vctrl-ui/ui/button'
import { CardContent } from '@vctrl-ui/ui/card'
import { cn } from '@vctrl-ui/utils'
import {
	Book,
	ExternalLink,
	File,
	FileQuestion,
	FolderUp,
	Image,
	Rocket,
	Upload,
	UserX2
} from 'lucide-react'
import { ComponentProps, useEffect, useTransition } from 'react'
import { useDropzone } from 'react-dropzone'

import { BasicCard } from '../../components'

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

	const { onClick, ...containerProps } = getRootProps<ComponentProps<'div'>>()

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
								<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
									<Upload className="h-4 w-4" />
									Choose Files
								</Button>
							) : (
								<BasicCard highlight>
									<div
										className={cn(
											'flex h-full flex-col items-center justify-center rounded-lg p-4 transition-all duration-300',
											isDragActive ? 'scale-[0.98] opacity-90' : 'scale-100'
										)}
									>
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
											Your files stay on your device until you choose to publish
										</p>

										<Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all duration-300">
											<Upload className="h-4 w-4" />
											Choose Files
										</Button>
									</div>
								</BasicCard>
							)}
							<div className="flex flex-row items-center justify-center gap-2">
								<Button
									variant="ghost"
									className="hover:bg-accent/50 flex h-auto grow items-center justify-center gap-3 rounded-xl p-3 md:justify-start"
									onClick={() => window.open('#', '_blank')}
								>
									<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md max-md:w-full">
										<Book className="h-4 w-4" />
									</div>
									{!isMobile && (
										<div className="text-left">
											<div className="font-medium">Quick Start Guide</div>
											<div className="text-muted-foreground text-xs">
												Learn the basics in 5 minutes
											</div>
										</div>
									)}
								</Button>

								<Button
									variant="ghost"
									className="hover:bg-accent/50 flex h-auto grow items-center justify-center gap-3 rounded-xl p-3 md:justify-start"
									onClick={() => window.open('#', '_blank')}
								>
									<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md max-md:w-full">
										<FileQuestion className="h-4 w-4" />
									</div>
									{!isMobile && (
										<div className="text-left">
											<div className="font-medium">Common Questions</div>
											<div className="text-muted-foreground text-xs">
												Get instant answers
											</div>
										</div>
									)}
								</Button>

								<Button
									variant="ghost"
									className="hover:bg-accent/50 flex h-auto grow items-center justify-center gap-3 rounded-xl p-3 md:justify-start"
									onClick={() => window.open('#', '_blank')}
								>
									<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md max-md:w-full">
										<ExternalLink className="h-4 w-4" />{' '}
									</div>
									{!isMobile && (
										<div className="text-left">
											<div className="font-medium"> Visit Help Center</div>
										</div>
									)}
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
