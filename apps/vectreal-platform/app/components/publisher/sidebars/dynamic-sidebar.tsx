import { Button } from '@shared/components/ui/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from '@shared/components/ui/drawer'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'

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
	 * When true, the desktop panel renders a built-in header bar with title, description,
	 * and a close button. Use for sidebars that don't supply their own header inside children
	 * (e.g. PublishSidebar whose header is identical in both contexts).
	 */
	showDesktopHeader?: boolean
	children: ReactNode
	className?: string
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
	className
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
					className="flex max-h-[95svh] flex-col"
					onOpenAutoFocus={(e) => {
						// Explicitly move focus into the first interactive element inside
						// the drawer so screen readers announce the new context.
						e.preventDefault()
						const container = e.currentTarget
						if (!(container instanceof HTMLElement)) {
							return
						}
						const first = container.querySelector<HTMLElement>(
							'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
						)
						first?.focus()
					}}
				>
					{showMobileHeader && (
						<DrawerHeader className="border-shell-border-soft shrink-0 border-b pb-3">
							<div className="flex items-start justify-between gap-2">
								<div>
									<DrawerTitle>{title}</DrawerTitle>
									{description && (
										<DrawerDescription>{description}</DrawerDescription>
									)}
								</div>
								{!closeDisabled && (
									<DrawerClose asChild>
										<Button variant="ghost" size="icon" className="shrink-0">
											<X className="h-4 w-4" />
										</Button>
									</DrawerClose>
								)}
							</div>
						</DrawerHeader>
					)}

					<div className="flex min-h-0 flex-1 flex-col">{children}</div>
				</DrawerContent>
			</Drawer>
		)
	}

	// ---- Desktop: fixed panel with framer-motion slide ----------------------
	const variants = direction === 'left' ? leftVariants : rightVariants
	const positionClass = direction === 'left' ? 'left-0' : 'right-0'

	return (
		<div
			className={cn(
				'pointer-events-none fixed top-0 h-full p-4',
				zIndexClassName,
				positionClass,
				{
					'px-0': !open
				}
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
							'publisher-shell-panel pointer-events-auto relative z-20 flex h-full w-[23rem] flex-col overflow-hidden',
							className
						)}
					>
						{showDesktopHeader && (
							<div className="border-shell-border-soft flex shrink-0 items-start justify-between border-b px-4 py-4">
								<div>
									<p className="text-lg font-medium">{title}</p>
									{description && (
										<p className="text-muted-foreground text-xs">
											{description}
										</p>
									)}
								</div>
								{!closeDisabled && (
									<Button
										variant="ghost"
										size="icon"
										className="publisher-shell-focus shrink-0"
										onClick={handleClose}
									>
										<X className="h-4 w-4" />
									</Button>
								)}
							</div>
						)}

						<div className="flex min-h-0 flex-1 flex-col">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
