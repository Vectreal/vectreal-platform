import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useId,
	useRef,
	useState
} from 'react'

import CrossIcon from './assets/cross-icon'
import InfoIcon from './assets/info-icon'
import { CHROME_BUTTON } from './chrome-classes'
import { cn, withHostClasses } from './class-names'

interface IPopoverContext {
	isOpen: boolean
	setIsOpen: (open: boolean) => void
}

const PopoverContext = createContext<IPopoverContext>({} as IPopoverContext)

const popoverClasses = {
	root: 'vctrl-viewer-info-popover vv:absolute vv:bottom-0 vv:z-[100] vv:m-2',
	triggerRoot:
		'vctrl-viewer-info-popover-trigger shell-panel vv:relative vv:p-1',
	triggerButton: cn(
		CHROME_BUTTON,
		'vv:flex vv:h-7 vv:w-7 vv:items-center vv:justify-center vv:rounded-full vv:p-0 vv:leading-none'
	),
	modalBase:
		'vctrl-viewer-info-popover-modal shell-panel vv:text-foreground vv:absolute vv:bottom-0 vv:left-0 vv:flex vv:w-64 vv:flex-col vv:overflow-hidden vv:transition-all vv:duration-300 vv:ease-out',
	modalOpen: 'vv:visible vv:translate-x-0 vv:translate-y-0 vv:opacity-100',
	modalClosed: 'vv:invisible vv:-translate-x-2 vv:translate-y-2 vv:opacity-0',
	textContainer: 'vv:grow vv:p-4 vv:mr-4 vv:[&_p]:text-sm',
	closeButton: cn(
		CHROME_BUTTON,
		'vv:absolute vv:top-0 vv:right-0 vv:m-2 vv:flex vv:h-8 vv:w-8 vv:items-center vv:justify-center vv:rounded-[var(--radius,1rem)] vv:p-2 vv:leading-none'
	)
} as const

interface PropsWithChildrenAndClass extends PropsWithChildren {
	className?: string
}

export const InfoPopover = ({
	children,
	className
}: PropsWithChildrenAndClass) => {
	const [isOpen, setIsOpen] = useState(false)
	const id = useId()

	return (
		<PopoverContext.Provider value={{ isOpen, setIsOpen }} key={id}>
			<div className={withHostClasses(popoverClasses.root, className)}>
				{children}
			</div>
		</PopoverContext.Provider>
	)
}

export const InfoPopoverTrigger = ({
	className
}: PropsWithChildrenAndClass) => {
	const { isOpen, setIsOpen } = useContext(PopoverContext)

	return (
		<div className={withHostClasses(popoverClasses.triggerRoot, className)}>
			<button
				className={popoverClasses.triggerButton}
				onClick={() => setIsOpen(true)}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				aria-controls="info-popover"
				aria-label="Open information popover"
			>
				<InfoIcon className="vv:h-4 vv:w-4" />
			</button>
		</div>
	)
}

export const InfoPopoverContent = ({
	children,
	className
}: PropsWithChildrenAndClass) => {
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
			className={withHostClasses(
				cn(
					popoverClasses.modalBase,
					isOpen ? popoverClasses.modalOpen : popoverClasses.modalClosed
				),
				className
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
}: PropsWithChildrenAndClass) => (
	<div className={withHostClasses(popoverClasses.textContainer, className)}>
		{children}
	</div>
)

export const InfoPopoverCloseButton = ({
	className
}: PropsWithChildrenAndClass) => {
	const { setIsOpen } = useContext(PopoverContext)

	return (
		<button
			onClick={() => setIsOpen(false)}
			aria-label="Close information popover"
			className={withHostClasses(popoverClasses.closeButton, className)}
		>
			<CrossIcon className="vv:h-4 vv:w-4" />
		</button>
	)
}
