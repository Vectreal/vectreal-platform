import { ModelFile, useModelContext } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import { useIsMobile } from '@vctrl-ui/hooks/use-mobile'
import { LoadingSpinner } from '@vctrl-ui/ui/loading-spinner'
import { SpinnerWrapper } from '@vctrl-ui/ui/spinner-wrapper'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { useAtom, useSetAtom } from 'jotai/react'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
	controlsAtom,
	environmentAtom,
	metaAtom,
	processAtom,
	shadowsAtom,
	toneMappingAtom
} from '../../lib/stores/publisher-config-store'
import { isMobileRequest } from '../../lib/utils/is-mobile-request'

import { Route } from './+types/publisher-page'
import { DropZone } from './drop-zone'

export async function loader({ request }: Route.LoaderArgs) {
	return { isMobile: isMobileRequest(request) }
}

const PublisherPage: React.FC<Route.ComponentProps> = ({ loaderData }) => {
	const [loadingStarted, setLoadingStarted] = useState(false)
	const isMobile = useIsMobile(loaderData.isMobile)
	const { isFileLoading, file, on, off, reset } = useModelContext()

	// publisher data store
	const [env] = useAtom(environmentAtom)
	const [toneMapping] = useAtom(toneMappingAtom)
	const [controls] = useAtom(controlsAtom)
	const [shadows] = useAtom(shadowsAtom)

	const setProcess = useSetAtom(processAtom)
	const setMeta = useSetAtom(metaAtom)

	function handleReset() {
		reset()
	}

	function handleNotLoadedFiles(files?: File[]) {
		toast.error(`Not loaded files: ${files?.map((f) => f.name).join(', ')}`)
	}

	function handleLoadComplete(data?: ModelFile | null) {
		if (!data) return

		toast.success(`Loaded ${data.name}`)

		setLoadingStarted(false)

		setMeta((prev) => ({
			...prev,
			sceneName: data.name.split('.').at(0) || ''
		}))

		setProcess((prev) => ({
			...prev,
			step: 'preparing',
			showInfo: true,
			showSidebar: false
		}))
	}

	useEffect(() => {
		if (file?.model) {
			setProcess((prev) => ({
				...prev,
				step: 'preparing',
				showInfo: false
			}))
		}
	}, [file, setProcess])

	function handleLoadError(error: unknown) {
		console.error('Load error:', error)
		toast.error(error as string)
		setLoadingStarted(false)
	}

	function handleLoadStart() {
		setLoadingStarted(true)
	}

	function handleScreenshot(url: string) {
		setMeta((prev) => ({
			...prev,
			thumbnailUrl: url
		}))
	}

	useEffect(() => {
		on('load-reset', handleReset)
		on('not-loaded-files', handleNotLoadedFiles)
		on('load-complete', handleLoadComplete)
		on('load-error', handleLoadError)
		on('load-start', handleLoadStart)

		return () => {
			off('load-reset', handleReset)
			off('not-loaded-files', handleNotLoadedFiles)
			off('load-complete', handleLoadComplete)
			off('load-error', handleLoadError)
			// off('load-start', handleLoadStart)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="grow overflow-hidden">
			<Suspense fallback={null}>
				<AnimatePresence>
					{!isFileLoading && file?.model ? (
						<motion.div
							key="model-viewer"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.75, delay: 1 }}
							className="bg-muted/50 flex h-full w-full"
						>
							<VectrealViewer
								model={file?.model}
								key="model-viewer"
								infoPopoverOptions={{ showInfo: false }}
								toneMappingOptions={toneMapping}
								envOptions={env}
								controlsOptions={controls}
								shadowsOptions={shadows}
								onScreenshot={handleScreenshot}
							/>
						</motion.div>
					) : isFileLoading || loadingStarted ? (
						<motion.div
							key="loading-spinner"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
							className="flex h-full w-full items-center justify-center"
						>
							<SpinnerWrapper>
								<LoadingSpinner />
							</SpinnerWrapper>
						</motion.div>
					) : (
						<motion.div
							key="drop-zone"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="relative flex h-full w-full items-center justify-center"
						>
							<DropZone key="drop-zone" isMobile={isMobile} />
						</motion.div>
					)}
				</AnimatePresence>
			</Suspense>
		</div>
	)
}

export default PublisherPage
