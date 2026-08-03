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
		? 'bg-orange animate-pulse'
		: isUnsaved
			? 'bg-orange'
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

	/*
	  One set of type classes for both states, which is the whole point of an
	  inline editor: clicking the text should put a caret in it, not swap it for
	  a different-looking control. The two used to disagree badly - the title
	  read at 30px and the input rendered it at 14px.

	  The `md:` twin is not redundant. `Input` and `Textarea` both carry
	  `text-base md:text-sm` (16px on small screens so iOS does not zoom the page
	  on focus), and tailwind-merge only drops a conflicting class inside the
	  same variant group - so a bare `text-3xl` from a caller leaves `md:text-sm`
	  standing and loses everywhere above the `md` breakpoint.
	*/
	const typeClasses = multiline
		? 'text-sm md:text-sm leading-relaxed'
		: titleStyle === 'title'
			? 'text-3xl md:text-3xl leading-tight font-light tracking-tight'
			: 'text-base md:text-base font-medium tracking-tight'

	// The input's own height, so the row does not resize under the click either.
	const boxClasses = multiline ? '' : titleStyle === 'title' ? 'h-12' : 'h-10'

	async function handleCommit() {
		setIsEditing(false)
		await onCommit()
	}

	const id = useId()

	return (
		<div className={cn('group flex items-start gap-3', className)}>
			{/*
			  No `overflow-x-auto` here. A scroll container clips at its padding
			  box on both axes, and both states fill it exactly - so the focus
			  ring, which the input draws as a box-shadow outside its border box,
			  was cut away on all four sides and the field read as a shape with
			  its edge sliced off. The horizontal scroll a long single-line value
			  needs belongs on the button below, which has its own surface to clip
			  against.
			*/}
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
							className={cn(
								'bg-background/70 h-fit max-h-48 resize-none border-0 px-2 py-1 shadow-none',
								typeClasses
							)}
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
								boxClasses,
								typeClasses
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
							// `overflow-x-auto` sits here rather than on the wrapper: a
							// long single-line value scrolls inside the field's own
							// surface, which is the thing that should clip it.
							'focus-visible:ring-ring bg-muted/25 flex w-full items-center overflow-x-auto rounded-lg px-2 py-1 text-left whitespace-pre transition-colors focus-visible:ring-2 focus-visible:outline-none',
							boxClasses,
							typeClasses,
							// The placeholder takes the same type rather than dropping to
							// `text-sm`, so an empty title does not jump two rungs the
							// moment it is clicked. Only the color says it is a
							// placeholder, which is what a placeholder does anyway.
							value.trim().length > 0
								? 'text-foreground'
								: 'text-muted-foreground'
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
