import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@shared/components/ui/select'
import { cn } from '@shared/utils'
import {
	useEffect,
	useRef,
	useState,
	type DragEvent,
	type FormEvent
} from 'react'
import { Link } from 'react-router'

import { DASHBOARD_ROUTES } from '../../../constants/dashboard'
import {
	useImgTo3dBatchStates,
	type ImgTo3dGeneration
} from '../../../hooks/use-img-to-3d-generation'
import {
	DEFAULT_IMG_TO_3D_PARAMS,
	IMG_TO_3D_DECIMATION_TARGET,
	IMG_TO_3D_ERROR_COPY,
	IMG_TO_3D_IMAGE_TYPES,
	IMG_TO_3D_RESOLUTIONS,
	IMG_TO_3D_SEED_COUNT,
	IMG_TO_3D_EXPIRED_COPY,
	IMG_TO_3D_TEXTURE_SIZES,
	describeImgTo3dVariant,
	imgTo3dOpenHref,
	imgTo3dVariantFileName,
	isTerminalImgTo3dStatus,
	type ImgTo3dListedBatch,
	type ImgTo3dListedVariant,
	type ImgTo3dResolution,
	type ImgTo3dTextureSize,
	type ImgTo3dVariantState
} from '../../../lib/domain/img-to-3d/img-to-3d-contract'

interface Props {
	generation: ImgTo3dGeneration
	/** The organization's recent batches, from the loader. */
	batches: readonly ImgTo3dListedBatch[]
	className?: string
}

const SEED_COUNTS = Array.from(
	{ length: IMG_TO_3D_SEED_COUNT.max - IMG_TO_3D_SEED_COUNT.min + 1 },
	(_, index) => IMG_TO_3D_SEED_COUNT.min + index
)

function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000))
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function describe(
	batch: ImgTo3dListedBatch,
	state: ImgTo3dVariantState,
	now: number
): string {
	if (batch.expired) return IMG_TO_3D_EXPIRED_COPY
	// A cold GPU takes minutes to boot, and this is where that time shows.
	if (state.status === 'queued') {
		return `Queued, ${formatElapsed(now - Date.parse(batch.createdAt))}`
	}
	return describeImgTo3dVariant(state)
}

/** A clock that ticks only while something is waiting, for the elapsed times. */
function useNowWhile(active: boolean): number {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		if (!active) return
		const timer = setInterval(() => setNow(Date.now()), 1_000)
		return () => clearInterval(timer)
	}, [active])
	return now
}

/**
 * Internal tooling: make a model from a product photo, as several seeded
 * variants to pick the best of. Shown only to accounts the image-to-3D flag
 * lets in, and plain on purpose; it is ours, not a product surface.
 *
 * A chosen variant opens like a dropped file, so optimization, hotspots and
 * publishing work on it unchanged.
 */
export const GenerateFromImage = ({
	generation,
	batches,
	className
}: Props) => {
	const { isSubmitting, submitError, opening } = generation
	const stateOf = useImgTo3dBatchStates(batches)

	const [image, setImage] = useState<File | null>(null)
	const imageInput = useRef<HTMLInputElement>(null)
	const [resolution, setResolution] = useState<ImgTo3dResolution>(
		DEFAULT_IMG_TO_3D_PARAMS.resolution
	)
	const [textureSize, setTextureSize] = useState<ImgTo3dTextureSize>(
		DEFAULT_IMG_TO_3D_PARAMS.textureSize
	)
	const [decimationTarget, setDecimationTarget] = useState(
		String(DEFAULT_IMG_TO_3D_PARAMS.decimationTarget)
	)
	const [seedCount, setSeedCount] = useState<number>(
		DEFAULT_IMG_TO_3D_PARAMS.seedCount
	)

	const now = useNowWhile(
		batches.some(
			(batch) =>
				!batch.expired &&
				batch.variants.some((variant) => {
					const { status } = stateOf(variant)
					return status !== null && !isTerminalImgTo3dStatus(status)
				})
		)
	)

	const triangles = Number(decimationTarget)
	const trianglesValid =
		Number.isInteger(triangles) &&
		triangles >= IMG_TO_3D_DECIMATION_TARGET.min &&
		triangles <= IMG_TO_3D_DECIMATION_TARGET.max

	/*
	  The panel sits on the empty stage, whose dropzone takes every drop as a
	  3D model. A photo dropped here is this form's, so the panel claims drag
	  events before they bubble to the stage, and puts the image in the field.
	*/
	const claimDrag = (event: DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
	}
	const handleDrop = (event: DragEvent) => {
		claimDrag(event)
		const file = event.dataTransfer.files[0]
		if (
			!file ||
			!(IMG_TO_3D_IMAGE_TYPES as readonly string[]).includes(file.type)
		) {
			return
		}
		setImage(file)
		if (imageInput.current) imageInput.current.files = event.dataTransfer.files
	}

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault()
		if (!image || !trianglesValid) return
		void generation.generate(image, {
			resolution,
			textureSize,
			decimationTarget: triangles,
			seedCount
		})
	}

	return (
		<section
			aria-labelledby="generate-from-image-label"
			className={cn('ds-raised w-full rounded-xl p-5 text-left', className)}
			onDragEnter={claimDrag}
			onDragOver={claimDrag}
			onDrop={handleDrop}
		>
			<div className="flex items-baseline justify-between gap-3">
				<p
					id="generate-from-image-label"
					className="text-muted-foreground text-eyebrow"
				>
					Generate from an image (internal)
				</p>
				{/* Every batch, including ones started in another tab or before a reload. */}
				<Link
					to={DASHBOARD_ROUTES.GENERATIONS}
					className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
				>
					All generations
				</Link>
			</div>

			<form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2 sm:col-span-2">
					<Label htmlFor="generate-image">Product photo</Label>
					<Input
						ref={imageInput}
						id="generate-image"
						type="file"
						accept={IMG_TO_3D_IMAGE_TYPES.join(',')}
						onChange={(event) => setImage(event.target.files?.[0] ?? null)}
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="generate-resolution">Resolution</Label>
					<Select
						value={String(resolution)}
						onValueChange={(value) =>
							setResolution(Number(value) as ImgTo3dResolution)
						}
					>
						<SelectTrigger id="generate-resolution" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{IMG_TO_3D_RESOLUTIONS.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="generate-texture-size">Texture size</Label>
					<Select
						value={String(textureSize)}
						onValueChange={(value) =>
							setTextureSize(Number(value) as ImgTo3dTextureSize)
						}
					>
						<SelectTrigger id="generate-texture-size" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{IMG_TO_3D_TEXTURE_SIZES.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{option} px
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="generate-triangles">Triangle target</Label>
					<Input
						id="generate-triangles"
						type="number"
						inputMode="numeric"
						min={IMG_TO_3D_DECIMATION_TARGET.min}
						max={IMG_TO_3D_DECIMATION_TARGET.max}
						step={10_000}
						value={decimationTarget}
						aria-invalid={!trianglesValid || undefined}
						onChange={(event) => setDecimationTarget(event.target.value)}
					/>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="generate-variants">Variants</Label>
					<Select
						value={String(seedCount)}
						onValueChange={(value) => setSeedCount(Number(value))}
					>
						<SelectTrigger id="generate-variants" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SEED_COUNTS.map((count) => (
								<SelectItem key={count} value={String(count)}>
									{count}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-3 sm:col-span-2">
					<Button
						type="submit"
						disabled={!image || !trianglesValid || isSubmitting}
					>
						{isSubmitting ? 'Starting' : 'Generate'}
					</Button>
					{submitError && (
						<p role="alert" className="text-destructive text-sm">
							{IMG_TO_3D_ERROR_COPY[submitError]}
						</p>
					)}
				</div>
			</form>

			{batches.length > 0 && (
				<ul aria-label="Recent generations" className="mt-5 grid gap-2">
					{batches.flatMap((batch) =>
						batch.variants.map((variant) => (
							<VariantRow
								key={variant.jobId}
								batch={batch}
								variant={variant}
								state={stateOf(variant)}
								opening={opening?.jobId === variant.jobId ? opening : null}
								onRetryOpen={generation.retryOpen}
								now={now}
							/>
						))
					)}
				</ul>
			)}
		</section>
	)
}

function VariantRow({
	batch,
	variant,
	state,
	opening,
	onRetryOpen,
	now
}: {
	batch: ImgTo3dListedBatch
	variant: ImgTo3dListedVariant
	state: ImgTo3dVariantState
	opening: ImgTo3dGeneration['opening']
	onRetryOpen: () => void
	now: number
}) {
	const ready = !batch.expired && state.status === 'succeeded'
	// On a ready variant an error is a failed open; the model is still there.
	const error = opening?.error ?? (state.status === 'failed' && !batch.expired)
	const fileName = imgTo3dVariantFileName(batch.sourceName, variant.seed)

	return (
		<li className="ds-raised flex items-center justify-between gap-3 rounded-lg px-3 py-2">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">
					{batch.sourceName ?? 'Untitled photo'}, seed {variant.seed}
				</p>
				<p
					className={cn(
						'truncate text-xs',
						error ? 'text-destructive' : 'text-muted-foreground'
					)}
					aria-live="polite"
				>
					{opening?.error
						? IMG_TO_3D_ERROR_COPY[opening.error]
						: opening
							? 'Opening'
							: describe(batch, state, now)}
				</p>
			</div>
			{ready && (
				<div className="flex shrink-0 gap-2">
					<Button asChild size="sm" variant="ghost">
						<a
							href={`/api/img-to-3d/generations/${encodeURIComponent(variant.jobId)}/artifact`}
							download={fileName}
							aria-label={`Download ${fileName}`}
						>
							Download
						</a>
					</Button>
					{/* Its URL is already the one open, so a link would go nowhere. */}
					{opening?.error ? (
						<Button size="sm" variant="outline" onClick={onRetryOpen}>
							Try again
						</Button>
					) : (
						<Button asChild size="sm" variant="outline">
							<Link to={imgTo3dOpenHref(variant.jobId)}>Open</Link>
						</Button>
					)}
				</div>
			)}
		</li>
	)
}
