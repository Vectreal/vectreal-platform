import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import {
	Sidebar,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem
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
	open?: boolean
}

const LogoSidebar = ({ children, ...sidebarProps }: LogoSidebarProps) => {
	const { smallLogo, open, ...rest } = sidebarProps

	const sidebarDefaultProps = {
		collapsible: 'icon',
		variant: 'inset',
		side: 'left',
		...rest
	} satisfies SidebarComponentProps

	return (
		<Sidebar {...sidebarDefaultProps}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						{/* <Link to="/dashboard"> */}
						<SidebarMenuButton
							asChild
							size="lg"
							className="overflow-clip md:h-8 md:p-0"
						>
							<Link to="/dashboard" viewTransition>
								{smallLogo ? (
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
