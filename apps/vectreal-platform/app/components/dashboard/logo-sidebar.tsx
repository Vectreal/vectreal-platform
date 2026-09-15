import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import { OVERLAY_CLOSE_APPEARANCE } from '@shared/components/ui/overlay-close'
import {
	Sidebar,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar
} from '@shared/components/ui/sidebar'
import { cn } from '@shared/utils'
import { XIcon } from 'lucide-react'
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
	const { open, openMobile, toggleSidebar, isMobile, setOpenMobile } =
		useSidebar()

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
			{/*
			  On a phone the sidebar is a sheet, and a sheet needs a way out that is
			  not only a tap on the dimmed page. The close sits in this row, beside
			  the logo, rather than pinned to the sheet's corner: pinned, it floated
			  over the logo row's own hover surface and read as removing the logo.
			*/}
			<SidebarHeader className={cn(isMobile && 'flex-row items-center gap-1')}>
				<SidebarMenu className={cn(isMobile && 'min-w-0 flex-1')}>
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
										<VectrealLogoSmall className="text-orange fill-accent size-4" />
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
				{isMobile ? (
					<button
						type="button"
						onClick={() => setOpenMobile(false)}
						/*
						  `-mr-0.5` puts the glyph on the same vertical line as the
						  menu rows' arrows. They sit 8px of group padding plus 8px of
						  button padding in; this 36px target in the header's 8px
						  padding centres 2px further left, measured at 27px against
						  25px from the sheet's edge.
						*/
						className={cn(OVERLAY_CLOSE_APPEARANCE, '-mr-0.5')}
					>
						<XIcon className="size-4" />
						<span className="sr-only">Close sidebar</span>
					</button>
				) : null}
			</SidebarHeader>
			{children}
		</Sidebar>
	)
}

export default LogoSidebar
