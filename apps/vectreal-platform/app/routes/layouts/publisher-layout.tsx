import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'

import { AnimatePresence } from 'framer-motion'
import { Provider, useAtomValue } from 'jotai/react'

import { PropsWithChildren } from 'react'
import { Outlet } from 'react-router'

import { Stepper } from '../../components/'
import { Sidebar, Toolbar } from '../../components/publisher'
import {
	processAtom,
	publisherConfigStore
} from '../../lib/stores/publisher-config-store'
import SidebarButtons from '../publisher-page/sidebar-buttons'

const AnimatedLayout = ({ children }: PropsWithChildren) => {
	const { file } = useModelContext()
	const { step } = useAtomValue(processAtom)

	const isNotUploadStep = file?.model && step !== 'uploading'
	const isPreparingStep = file?.model && step === 'preparing'

	return (
		<AnimatePresence>
			<main className="h-screen w-full overflow-hidden">
				<section className="flex h-full w-full flex-col overflow-hidden">
					{isNotUploadStep && <Toolbar />}
					<div className="relative mb-12 flex grow overflow-hidden">
						{isNotUploadStep && <Sidebar />}
						{isPreparingStep && <SidebarButtons />}
						{children}
					</div>
					<Stepper />
				</section>
			</main>
		</AnimatePresence>
	)
}

const Layout = () => {
	const optimizer = useOptimizeModel()

	return (
		<ModelProvider optimizer={optimizer}>
			<Provider store={publisherConfigStore}>
				<AnimatedLayout>
					<Outlet />
				</AnimatedLayout>
			</Provider>
		</ModelProvider>
	)
}

export default Layout
