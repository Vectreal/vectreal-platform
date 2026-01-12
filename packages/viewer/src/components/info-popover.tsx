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

import styles from './info-popover.module.css'

interface IPopoverContext {
	isOpen: boolean
	setIsOpen: (open: boolean) => void
}

const PopoverContext = createContext<IPopoverContext>({} as IPopoverContext)

export const InfoPopover = ({ children }: PropsWithChildren) => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<PopoverContext.Provider value={{ isOpen, setIsOpen }}>
			<div className={cn('vctrl-viewer-info-popover', styles.popover)}>
				{children}
			</div>
		</PopoverContext.Provider>
	)
}

export const InfoPopoverTrigger = () => {
	const { isOpen, setIsOpen } = useContext(PopoverContext)
	return (
		<div
			className={cn(
				'vctrl-viewer-info-popover-trigger',
				styles['popover-trigger']
			)}
		>
			<button
				onClick={() => setIsOpen(true)}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				aria-controls="info-popover"
				aria-label="Open information popover"
			>
				<InfoIcon />
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
				'vctrl-viewer-info-popover-modal',
				styles['popover-modal'],
				isOpen ? styles.show : styles.hide
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
	<div className={cn(styles['text-container'], className)}>{children}</div>
)

export const InfoPopoverCloseButton = () => {
	const { setIsOpen } = useContext(PopoverContext)

	return (
		<button
			onClick={() => setIsOpen(false)}
			aria-label="Close information popover"
			className={styles['popover-close']}
		>
			<CrossIcon />
		</button>
	)
}

export const InfoPopoverVectrealFooter = () => (
	<a
		className={styles['popover-footer']}
		href="https://core.vectreal.com"
		target="_blank"
		rel="noopener noreferrer"
	>
		Vectreal viewer
		<VectrealLogoSmall />
	</a>
)
