import { Input } from '@shared/components/ui/input'
import { Textarea } from '@shared/components/ui/textarea'
import { cn } from '@shared/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'

type InlineEditableMetadataFieldProps = {
	ariaLabel: string
	value: string
	placeholder: string
	multiline?: boolean
	titleStyle?: 'title' | 'body'
	isUnsaved: boolean
	isSaving: boolean
	isSaved: boolean
	indicatorTitle?: string
	onChange: (nextValue: string) => void
	onCommit: () => void | Promise<void>
	className?: string
}

const MotionTextarea = motion.create(Textarea)
const MotionInput = motion.create(Input)

export function InlineEditableMetadataField({
	ariaLabel,
	value,
	placeholder,
	multiline = false,
	titleStyle = 'body',
	isUnsaved,
	isSaving,
	isSaved,
	indicatorTitle,
	onChange,
	onCommit,
	className
}: InlineEditableMetadataFieldProps) {
	const [isEditing, setIsEditing] = useState(false)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)

	useEffect(() => {
		if (!isEditing) {
			return
		}

		if (multiline) {
			textareaRef.current?.focus()
			return
		}

		inputRef.current?.focus()
	}, [isEditing, multiline])

	const indicatorClass = isSaving
		? 'bg-accent animate-pulse'
		: isUnsaved
			? 'bg-accent'
			: isSaved
				? 'opacity-0'
				: 'bg-muted-foreground/35'

	const indicatorStateText = isSaving
		? 'Saving'
		: isUnsaved
			? 'Unsaved changes'
			: isSaved
				? 'Saved'
				: 'No changes'

	const displayText = value.trim().length > 0 ? value : placeholder

	async function handleCommit() {
		setIsEditing(false)
		await onCommit()
	}

	const id = useId()

	return (
		<div className={cn('group flex items-start gap-3', className)}>
			<div className="min-w-0 flex-1">
				{isEditing ? (
					multiline ? (
						<MotionTextarea
							layout
							layoutId={`inline-edit-${id}`}
							ref={textareaRef}
							value={value}
							onChange={(event) => onChange(event.target.value)}
							onBlur={() => {
								void handleCommit()
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey) {
									event.preventDefault()
									void handleCommit()
								}
							}}
							placeholder={placeholder}
							aria-label={ariaLabel}
							className="bg-background/70 h-fit max-h-48 resize-none border-0 px-2 py-1 text-sm shadow-none"
						/>
					) : (
						<MotionInput
							layout
							layoutId={`inline-edit-${id}`}
							ref={inputRef}
							value={value}
							onChange={(event) => onChange(event.target.value)}
							onBlur={() => {
								void handleCommit()
							}}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault()
									void handleCommit()
								}
							}}
							placeholder={placeholder}
							aria-label={ariaLabel}
							className={cn(
								'bg-background/70 border-0 px-2 shadow-none',
								titleStyle === 'title'
									? 'h-12 text-3xl leading-tight font-light tracking-tight'
									: 'h-10 text-sm'
							)}
						/>
					)
				) : (
					<motion.button
						layout="position"
						layoutId={`inline-edit-${id}`}
						type="button"
						onClick={() => setIsEditing(true)}
						aria-label={`Edit ${ariaLabel}`}
						className={cn(
							'focus-visible:ring-ring bg-muted/25 w-full rounded-xl px-2 py-1 text-left leading-snug! whitespace-pre transition-colors focus-visible:ring-2 focus-visible:outline-none',
							value.trim().length > 0
								? multiline
									? 'text-foreground text-sm leading-relaxed'
									: titleStyle === 'title'
										? 'text-foreground text-3xl leading-tight font-light tracking-tight'
										: 'text-foreground text-base font-medium tracking-tight'
								: 'text-muted-foreground text-sm'
						)}
					>
						{displayText}
					</motion.button>
				)}
			</div>
			<AnimatePresence>
				{(isSaving || isUnsaved) && (
					<div className="shrink-0 pt-2">
						<motion.div
							layout
							aria-hidden="true"
							key="indicator"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							title={
								indicatorTitle ?? `${ariaLabel} status: ${indicatorStateText}`
							}
							className={cn(
								'h-2.5 w-2.5 rounded-full transition-opacity duration-400',
								indicatorClass,
								isSaving || isUnsaved ? 'opacity-100' : 'opacity-0'
							)}
						/>
						<span className="sr-only" aria-live="polite">
							{ariaLabel} {indicatorStateText}
						</span>
					</div>
				)}
			</AnimatePresence>
		</div>
	)
}
