import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
	MODEL_INTAKE_MAX_PHOTO_BYTES,
	MODEL_INTAKE_PHOTO_ACCEPT,
	MODEL_INTAKE_PHOTO_COUNT
} from '../../lib/domain/model-intake/model-intake-shared'

interface PhotoSlotsProps {
	labels: {
		slot: (n: number) => string
		add: string
		remove: (n: number) => string
	}
	/** 1-based photo an error is about, or 0 for the whole set. */
	invalidIndex?: number
	describedBy?: string
	/**
	 * Reports, per slot (1-based), whether its last pick was refused for size.
	 * Checked here so a browser never sends a file the server would refuse
	 * unread, and so the message can name the photo.
	 */
	onTooLarge: (n: number, tooLarge: boolean) => void
}

/**
 * Three photo inputs, one per slot, each showing what was picked.
 *
 * Each slot is a real `<input type="file" name="photos">`, so the form posts
 * the files in slot order with no client state in the way, and the photos stay
 * picked across a failed submit because the inputs are never remounted. The
 * preview is the decoded photo drawn on a canvas, so no URL made from the
 * picked file is ever handed to the DOM.
 *
 * Browsers that cannot decode HEIC show no preview for it, so a slot falls
 * back to the file name: the server converts it either way.
 */
export function PhotoSlots({
	labels,
	invalidIndex,
	describedBy,
	onTooLarge
}: PhotoSlotsProps) {
	return (
		<div className="grid grid-cols-3 gap-3">
			{Array.from({ length: MODEL_INTAKE_PHOTO_COUNT }, (_, index) => (
				<PhotoSlot
					key={index}
					n={index + 1}
					labels={labels}
					invalid={invalidIndex === 0 || invalidIndex === index + 1}
					describedBy={describedBy}
					onTooLarge={onTooLarge}
				/>
			))}
		</div>
	)
}

/** The square preview's backing size: sharp on a slot of about 170 CSS pixels at 3x. */
const PREVIEW_PIXELS = 512

/** Draws the photo's centered square over the whole canvas, as object-fit: cover would. */
function drawCovering(context: CanvasRenderingContext2D, bitmap: ImageBitmap) {
	const side = Math.min(bitmap.width, bitmap.height)
	context.clearRect(0, 0, PREVIEW_PIXELS, PREVIEW_PIXELS)
	context.drawImage(
		bitmap,
		(bitmap.width - side) / 2,
		(bitmap.height - side) / 2,
		side,
		side,
		0,
		0,
		PREVIEW_PIXELS,
		PREVIEW_PIXELS
	)
}

function PhotoSlot({
	n,
	labels,
	invalid,
	describedBy,
	onTooLarge
}: {
	n: number
	labels: PhotoSlotsProps['labels']
	invalid: boolean
	describedBy?: string
	onTooLarge: PhotoSlotsProps['onTooLarge']
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [file, setFile] = useState<File | null>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [previewShown, setPreviewShown] = useState(false)

	useEffect(() => {
		setPreviewShown(false)
		if (!file) return
		let cancelled = false
		createImageBitmap(file).then(
			(bitmap) => {
				const context = canvasRef.current?.getContext('2d')
				if (!cancelled && context) {
					drawCovering(context, bitmap)
					setPreviewShown(true)
				}
				bitmap.close()
			},
			// Undecodable here (HEIC outside Safari): the slot shows the file name.
			() => undefined
		)
		return () => {
			cancelled = true
		}
	}, [file])

	const pick = (picked: File | null) => {
		if (picked && picked.size > MODEL_INTAKE_MAX_PHOTO_BYTES) {
			if (inputRef.current) inputRef.current.value = ''
			setFile(null)
			onTooLarge(n, true)
			return
		}
		onTooLarge(n, false)
		setFile(picked)
	}

	const clear = () => {
		if (inputRef.current) inputRef.current.value = ''
		setFile(null)
		onTooLarge(n, false)
		inputRef.current?.focus()
	}

	const inputId = `photo-${n}`

	return (
		<div className="relative">
			<label
				htmlFor={inputId}
				className={cn(
					'ds-field focus-within:outline-ring relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl p-2 text-center focus-within:outline-2 focus-within:outline-offset-2',
					invalid && 'ring-destructive ring-1'
				)}
			>
				<input
					ref={inputRef}
					id={inputId}
					type="file"
					name="photos"
					accept={MODEL_INTAKE_PHOTO_ACCEPT}
					className="sr-only"
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					onChange={(event) => pick(event.target.files?.[0] ?? null)}
				/>
				<canvas
					ref={canvasRef}
					width={PREVIEW_PIXELS}
					height={PREVIEW_PIXELS}
					role="img"
					aria-label={labels.slot(n)}
					className={cn(
						'absolute inset-0 h-full w-full',
						!previewShown && 'hidden'
					)}
				/>
				{previewShown ? null : (
					<>
						<ImagePlus
							aria-hidden="true"
							className="text-muted-foreground h-5 w-5"
						/>
						<span className="text-label-xs text-muted-foreground">
							{labels.slot(n)}
						</span>
						<span className="text-body-sm line-clamp-2 break-all">
							{file ? file.name : labels.add}
						</span>
					</>
				)}
			</label>
			{file ? (
				<Button
					type="button"
					size="icon"
					variant="secondary"
					className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full"
					aria-label={labels.remove(n)}
					onClick={clear}
				>
					<X className="h-3.5 w-3.5" />
				</Button>
			) : null}
		</div>
	)
}
