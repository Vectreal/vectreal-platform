import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import {
	Sidebar,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar
} from '@shared/components/ui/sidebar'
import { PropsWithChildren } from 'react'
import { Link } from 'react-router'

interface SidebarComponentProps {
	side?: 'left' | 'right'
	variant?: 'sidebar' | 'floating' | 'inset'
	collapsible?: 'offcanvas' | 'icon' | 'none'
}

interface LogoSidebarProps extends PropsWithChildren, SidebarComponentProps {
	smallLogo?: boolean
	className?: string
}

const LogoSidebar = ({ children, ...sidebarProps }: LogoSidebarProps) => {
	const { smallLogo, ...rest } = sidebarProps
	const { open, openMobile, toggleSidebar } = useSidebar()

	const sidebarDefaultProps = {
		collapsible: 'icon',
		variant: 'inset',
		side: 'left',
		...rest
	} satisfies SidebarComponentProps

	const handleCloseMobile = () => {
		if (openMobile) {
			toggleSidebar()
		}
	}

	return (
		<Sidebar {...sidebarDefaultProps}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* <Link to="/dashboard"> */}
						<SidebarMenuButton
							asChild
							size="lg"
							onClick={handleCloseMobile}
							className="overflow-clip md:h-8 md:p-0"
						>
							<Link to="/dashboard" viewTransition>
								{smallLogo || !open ? (
									<div className="flex aspect-square size-8 items-center">
										<VectrealLogoSmall className="text-accent fill-accent size-4" />
									</div>
								) : (
									<div className="flex items-center pl-2">
										<VectrealLogoAnimated
											small={!open}
											className="h-5!"
											colored
										/>
									</div>
								)}
							</Link>
						</SidebarMenuButton>
						{/* </Link> */}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			{children}
		</Sidebar>
	)
}

export default LogoSidebar
