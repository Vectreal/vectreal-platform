import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import { cn } from '@shared/utils'
import { useEffect, useRef, useState } from 'react'

import CrossIcon from './assets/cross-icon'
import InfoIcon from './assets/info-icon'

import styles from './info-popover.module.css'

export interface InfoPopoverProps {
	/**
	 * Whether to add the info popover and it's trigger to the viewer.
	 */
	showInfo?: boolean

	/**
	 * The content to display in the popover. Can be a JSX element or a string.
	 */
	content?: React.ReactNode | string
}

export const defaultInfoPopoverProps: InfoPopoverProps = {
	showInfo: true
}

const InfoPopover = (props: InfoPopoverProps) => {
	const { content, showInfo } = { ...defaultInfoPopoverProps, ...props }
	const [isOpen, setIsOpen] = useState(false)
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
	}, [isOpen])

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
		showInfo && (
			<div className={cn('vctrl-viewer-info-popover', styles.popover)}>
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
					<button
						onClick={() => setIsOpen(false)}
						aria-label="Close information popover"
						className={styles['popover-close']}
					>
						<CrossIcon />
					</button>
					<div className={styles['text-container']}>
						{content ? (
							typeof content === 'string' ? (
								<p>{content}</p>
							) : (
								content
							)
						) : (
							<p>No additional info</p>
						)}
					</div>

					<a
						className={styles['popover-footer']}
						href="https://core.vectreal.com"
						target="_blank"
						rel="noopener noreferrer"
					>
						Vectreal viewer
						<VectrealLogoSmall />
					</a>
				</div>
			</div>
		)
	)
}

export default InfoPopover
