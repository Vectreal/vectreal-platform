import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import { cn } from '@shared/utils'
import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react'

import CrossIcon from './assets/cross-icon'
import InfoIcon from './assets/info-icon'

interface IPopoverContext {
	isOpen: boolean
	setIsOpen: (open: boolean) => void
}

const PopoverContext = createContext<IPopoverContext>({} as IPopoverContext)

const popoverClasses = {
	root: 'vctrl-viewer-info-popover absolute bottom-0 z-[100] m-2',
	triggerRoot: 'vctrl-viewer-info-popover-trigger relative h-6 w-6',
	triggerButton:
		'z-10 h-full w-full cursor-pointer rounded-full bg-[var(--vctrl-bg)] p-1 hover:bg-[var(--vctrl-hover-bg)] active:bg-[var(--vctrl-active-bg)]',
	modalBase:
		'vctrl-viewer-info-popover-modal absolute bottom-0 left-0 flex w-64 flex-col overflow-hidden rounded-lg bg-[var(--vctrl-bg)] transition-all duration-300 ease-out',
	modalOpen: 'visible translate-x-0 translate-y-0 opacity-100',
	modalClosed: 'invisible -translate-x-2 translate-y-2 opacity-0',
	textContainer: 'grow p-4 mr-4 [&_p]:text-sm [&_p]:text-[var(--vctrl-text)]',
	closeButton:
		'absolute right-0 top-0 m-2 h-8 w-8 cursor-pointer rounded bg-[var(--vctrl-bg)] p-2 text-[var(--vctrl-text)] transition-all duration-300 ease-in-out hover:bg-[var(--vctrl-hover-bg)] active:bg-[var(--vctrl-active-bg)]',
	footer:
		'flex cursor-pointer items-center justify-between gap-2 border-t border-[var(--vctrl-border)] bg-[var(--vctrl-bg)] px-4 py-2 text-xs text-[var(--vctrl-text)] transition-[color,background-color] duration-300 hover:bg-[var(--vctrl-hover-bg)] active:bg-[var(--vctrl-active-bg)] [&_svg]:h-4 [&_svg]:w-4'
} as const

export const InfoPopover = ({ children }: PropsWithChildren) => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<PopoverContext.Provider value={{ isOpen, setIsOpen }}>
			<div className={cn(popoverClasses.root)}>{children}</div>
		</PopoverContext.Provider>
	)
}

export const InfoPopoverTrigger = () => {
	const { isOpen, setIsOpen } = useContext(PopoverContext)
	return (
		<div className={cn(popoverClasses.triggerRoot)}>
			<button
				className={cn(popoverClasses.triggerButton)}
				onClick={() => setIsOpen(true)}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				aria-controls="info-popover"
				aria-label="Open information popover"
			>
				<InfoIcon className="h-4 w-4 text-[var(--vctrl-text)]" />
			</button>
		</div>
	)
}

export const InfoPopoverContent = ({
	children
}: {
	children: React.ReactNode
}) => {
	const { isOpen, setIsOpen } = useContext(PopoverContext)
	const popoverRef = useRef<HTMLDivElement>(null)

	// Handle focus when modal opens and closes
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && isOpen) {
				setIsOpen(false)
			}
		}

		if (isOpen) {
			// Move focus to the modal
			popoverRef.current?.focus()
			document.addEventListener('keydown', handleKeyDown)
		}

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, setIsOpen])

	// Trap focus within the modal when it's open
	useEffect(() => {
		const trapFocus = (event: FocusEvent) => {
			if (
				isOpen &&
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node)
			) {
				event.preventDefault()
				popoverRef.current?.focus()
			}
		}

		if (isOpen) {
			document.addEventListener('focusin', trapFocus)
		} else {
			document.removeEventListener('focusin', trapFocus)
		}

		return () => {
			document.removeEventListener('focusin', trapFocus)
		}
	}, [isOpen])

	return (
		<div
			id="info-popover"
			role="dialog"
			aria-modal="true"
			className={cn(
				popoverClasses.modalBase,
				isOpen ? popoverClasses.modalOpen : popoverClasses.modalClosed
			)}
			ref={popoverRef}
			tabIndex={-1}
		>
			{children}
		</div>
	)
}

export const InfoPopoverText = ({
	children,
	className
}: PropsWithChildren<{ className?: string }>) => (
	<div className={cn(popoverClasses.textContainer, className)}>{children}</div>
)

export const InfoPopoverCloseButton = () => {
	const { setIsOpen } = useContext(PopoverContext)

	return (
		<button
			onClick={() => setIsOpen(false)}
			aria-label="Close information popover"
			className={cn(popoverClasses.closeButton)}
		>
			<CrossIcon className="h-4 w-4" />
		</button>
	)
}

export const InfoPopoverVectrealFooter = () => (
	<a
		className={cn(popoverClasses.footer)}
		href="https://vectreal.com"
		target="_blank"
		rel="noopener noreferrer"
	>
		Vectreal viewer
		<VectrealLogoSmall />
	</a>
)
