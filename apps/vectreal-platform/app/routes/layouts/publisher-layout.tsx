import { User } from '@supabase/supabase-js'
import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { SidebarProvider } from '@vctrl-ui/ui/sidebar'
import { Provider, useAtom, useAtomValue } from 'jotai/react'
import { PropsWithChildren, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router'

import { Navigation } from '../../components'
import { PublisherSidebar, Stepper } from '../../components/publisher'
import PublisherButtons from '../../components/publisher/publisher-buttons'
import {
	processAtom,
	publisherConfigStore
} from '../../lib/stores/publisher-config-store'

import { createClient } from '../../lib/supabase.server'

import { Route } from './+types/publisher-layout'

export const loader = async ({ request }: Route.LoaderArgs) => {
	const { client } = await createClient(request)
	const {
		data: { user }
	} = await client.auth.getUser()
	return { user }
}
const AnimatedLayout = ({
	children,
	user
}: PropsWithChildren<{ user: User | null }>) => {
	const location = useLocation()
	const pathname = location.pathname
	const { file } = useModelContext()
	const { step } = useAtomValue(processAtom)

	const isUploadStep = !file?.model && step === 'uploading'

	return (
		<>
			{isUploadStep && <Navigation pathname={pathname} user={user} />}
			{!isUploadStep && <Stepper />}
			<main className="flex h-screen w-full flex-col overflow-hidden">
				{!isUploadStep && <PublisherSidebar />}
				{/* {isPreparingStep && <StatusIndicator />} */}
				<PublisherButtons />
				{children}
			</main>
		</>
	)
}

const Layout = ({ loaderData }: Route.ComponentProps) => {
	const optimizer = useOptimizeModel()
	const [{ showSidebar }, setProcessState] = useAtom(processAtom)
	const { user } = loaderData

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			setProcessState((prev) => ({
				...prev,
				showSidebar: isOpen
			}))
		},
		[setProcessState]
	)

	return (
		<SidebarProvider open={showSidebar} onOpenChange={handleOpenChange}>
			<ModelProvider optimizer={optimizer}>
				<Provider store={publisherConfigStore}>
					<AnimatedLayout user={user}>
						<Outlet />
					</AnimatedLayout>
				</Provider>
			</ModelProvider>
		</SidebarProvider>
	)
}

export default Layout
