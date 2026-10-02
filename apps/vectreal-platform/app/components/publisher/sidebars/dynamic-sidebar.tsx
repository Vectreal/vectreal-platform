import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import { OVERLAY_CLOSE_APPEARANCE } from '@shared/components/ui/overlay-close'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const leftVariants: Variants = {
	hidden: { opacity: 0, x: '-100%' },
	visible: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: '-100%' }
}

const rightVariants: Variants = {
	hidden: { opacity: 0, x: '100%' },
	visible: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: '100%' }
}

// ---------------------------------------------------------------------------
// Canvas reach
// ---------------------------------------------------------------------------

/*
  Whether the panel is the mobile bottom sheet. The sheet is modal and covers
  the stage, so while it is open nothing on the 3D canvas can be touched, and a
  panel must not offer or describe an action that happens there (placing a
  marker, dragging it). Decided here because this is where the sheet is
  chosen; a panel measuring the window itself could disagree with it.
*/
const CoversCanvasContext = createContext(false)

/** True inside the mobile sheet, where the canvas cannot be reached. */
export const useSidebarCoversCanvas = () => useContext(CoversCanvasContext)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DynamicSidebarProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Tailwind z-index class applied to the fixed desktop container. */
	zIndexClassName?: string
	/** When true, all close affordances are hidden/disabled. */
	closeDisabled?: boolean
	/** When true, renders a vaul Drawer (bottom sheet) instead of the fixed desktop panel. */
	isMobile: boolean
	/** Which edge the panel slides from. Defaults to 'left'. */
	direction?: 'left' | 'right'
	/** Used as DrawerTitle on mobile (required for accessibility). Also shown when showDesktopHeader is true. */
	title: string
	description?: string
	/** Whether to render the built-in mobile drawer header. */
	showMobileHeader?: boolean
	/**
	 * When true, the desktop panel renders a built-in header bar with title and
	 * description, and its close button sits in that bar. Use for sidebars that
	 * don't supply their own header inside children (e.g. PublishSidebar whose
	 * header is identical in both contexts). Without it the close button still
	 * renders, in the panel's top-right corner, as the mobile drawer's does.
	 */
	showDesktopHeader?: boolean
	children: ReactNode
	className?: string
	/**
	 * Classes for the desktop container the panel is inset within, for a panel
	 * that has to clear other stage chrome (the tool bar).
	 */
	containerClassName?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DynamicSidebar = ({
	open,
	onOpenChange,
	isMobile,
	direction = 'left',
	title,
	description,
	closeDisabled = false,
	zIndexClassName = 'z-40',
	showMobileHeader = true,
	showDesktopHeader = false,
	children,
	className,
	containerClassName
}: DynamicSidebarProps) => {
	const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])

	// ---- Mobile: bottom-sheet Drawer ----------------------------------------
	if (isMobile) {
		return (
			<Drawer
				open={open}
				dismissible={!closeDisabled}
				onOpenChange={(next) => {
					if (!next && closeDisabled) {
						return
					}
					if (next) {
						// Blur the triggering element before the drawer opens. Vaul sets
						// aria-hidden on the rest of the page synchronously; if a button
						// that triggered the open still has focus, it ends up inside an
						// aria-hidden region, which is an accessibility violation.
						;(document.activeElement as HTMLElement | null)?.blur()
					}
					onOpenChange(next)
				}}
			>
				<DrawerContent
					showCloseButton={!closeDisabled}
					/*
					  A fixed height rather than the content's. Drill-down views differ a
					  lot in length, and a sheet sized to each one moved its top edge on
					  every step, uncovering and covering the model. Platform sheets do
					  the same: they rest at set heights and scroll what does not fit,
					  which every publisher sheet already does inside its body.
					*/
					className="flex h-[60svh] flex-col"
					onOpenAutoFocus={(event) => {
						// Focus the sheet itself, which announces it by its title. The
						// first control inside can be a tooltip trigger, and a tooltip
						// opens on focus, so it showed without anyone asking for it.
						event.preventDefault()
						if (event.currentTarget instanceof HTMLElement) {
							event.currentTarget.focus()
						}
					}}
				>
					{/*
					  The header is pinned to the tighter `p-4` the shared component used
					  to default to. This is a publisher sidebar rather than a dashboard
					  drawer, and its content is not padded `p-6`.
					*/}
					{showMobileHeader && (
						<DrawerHeader className="border-shell-border-soft shrink-0 border-b p-4 pr-14 pb-3">
							<DrawerTitle>{title}</DrawerTitle>
							{description && (
								<DrawerDescription>{description}</DrawerDescription>
							)}
						</DrawerHeader>
					)}

					<div className="flex min-h-0 flex-1 flex-col">
						<CoversCanvasContext.Provider value={true}>
							{children}
						</CoversCanvasContext.Provider>
					</div>
				</DrawerContent>
			</Drawer>
		)
	}

	// ---- Desktop: panel inside the canvas stage, framer-motion slide --------
	const variants = direction === 'left' ? leftVariants : rightVariants
	const positionClass = direction === 'left' ? 'left-0' : 'right-0'

	/*
	  One close button whichever header the panel has. It used to exist only
	  inside `showDesktopHeader`, and the optimization panel draws its own header,
	  so once its hand-rolled button was removed for doubling the mobile drawer's
	  built-in one, the desktop panel had no way out at all. Without the built-in
	  header it takes the corner the drawer's own close takes.
	*/
	const closeButton = !closeDisabled && (
		<button
			type="button"
			aria-label="Close"
			className={cn(
				OVERLAY_CLOSE_APPEARANCE,
				'publisher-shell-focus',
				!showDesktopHeader && 'absolute top-4 right-4'
			)}
			onClick={handleClose}
		>
			<X className="size-4" />
		</button>
	)

	return (
		// Absolute, not fixed: the publisher stage is the positioning ancestor, so
		// the panel is inset within the canvas and never rides over the header or
		// footer rows.
		<div
			className={cn(
				'pointer-events-none absolute inset-y-0 p-4',
				zIndexClassName,
				positionClass,
				{
					'px-0': !open
				},
				containerClassName
			)}
		>
			<AnimatePresence mode="wait">
				{open && (
					<motion.div
						key="panel"
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={variants}
						transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
						className={cn(
							'publisher-shell-panel w-detail-panel pointer-events-auto relative z-20 flex h-full flex-col overflow-hidden',
							className
						)}
					>
						{showDesktopHeader && (
							/*
							  The mobile drawer header, rebuilt for the desktop panel - so
							  it is held to the same tokens. It used to hand-roll all three
							  parts: a `<p className="text-lg font-medium">` for the title,
							  a `text-xs` description where the drawer uses `text-sm`, and
							  a ghost icon button that was a fourth close treatment.
							*/
							<div className="border-shell-border-soft flex shrink-0 items-start justify-between gap-2 border-b p-4">
								<div className="min-w-0">
									<h2 className="text-foreground text-h3">{title}</h2>
									{description && (
										<p className="text-muted-foreground text-sm">
											{description}
										</p>
									)}
								</div>
								{closeButton}
							</div>
						)}

						<div className="flex min-h-0 flex-1 flex-col">{children}</div>
						{!showDesktopHeader && closeButton}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
