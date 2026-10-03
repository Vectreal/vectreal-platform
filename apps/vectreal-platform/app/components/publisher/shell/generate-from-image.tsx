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
import { useEffect, useState, type FormEvent } from 'react'

import {
	DEFAULT_IMG_TO_3D_PARAMS,
	IMG_TO_3D_DECIMATION_TARGET,
	IMG_TO_3D_ERROR_COPY,
	IMG_TO_3D_IMAGE_TYPES,
	IMG_TO_3D_RESOLUTIONS,
	IMG_TO_3D_SEED_COUNT,
	IMG_TO_3D_TEXTURE_SIZES,
	isTerminalImgTo3dStatus,
	type ImgTo3dResolution,
	type ImgTo3dTextureSize
} from '../../../lib/domain/img-to-3d/img-to-3d-contract'

import type {
	ImgTo3dCandidate,
	ImgTo3dGeneration
} from '../../../hooks/use-img-to-3d-generation'

interface Props {
	generation: ImgTo3dGeneration
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

function describe(candidate: ImgTo3dCandidate, now: number): string {
	switch (candidate.status) {
		case 'queued':
			// A cold GPU takes minutes to boot, and this is where that time shows.
			return `Queued, ${formatElapsed(now - candidate.submittedAt)}`
		case 'processing':
			return candidate.progress === null
				? 'Generating'
				: `Generating, ${candidate.progress}%`
		case 'succeeded':
		case 'failed':
			// On a succeeded job an error is a failed open; the model is still ready.
			return candidate.error
				? IMG_TO_3D_ERROR_COPY[candidate.error]
				: candidate.status === 'succeeded'
					? 'Ready'
					: IMG_TO_3D_ERROR_COPY.generation_failed
	}
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
export const GenerateFromImage = ({ generation, className }: Props) => {
	const { candidates, isSubmitting, submitError, loadingJobId } = generation

	const [image, setImage] = useState<File | null>(null)
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
		candidates.some((candidate) => !isTerminalImgTo3dStatus(candidate.status))
	)

	const triangles = Number(decimationTarget)
	const trianglesValid =
		Number.isInteger(triangles) &&
		triangles >= IMG_TO_3D_DECIMATION_TARGET.min &&
		triangles <= IMG_TO_3D_DECIMATION_TARGET.max

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
		>
			<p
				id="generate-from-image-label"
				className="text-muted-foreground text-eyebrow"
			>
				Generate from an image (internal)
			</p>

			<form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
				<div className="grid gap-2 sm:col-span-2">
					<Label htmlFor="generate-image">Product photo</Label>
					<Input
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

			{candidates.length > 0 && (
				<ul aria-label="Generated variants" className="mt-5 grid gap-2">
					{candidates.map((candidate) => (
						<li
							key={candidate.jobId}
							className="ds-raised flex items-center justify-between gap-3 rounded-lg px-3 py-2"
						>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{candidate.sourceName}, seed {candidate.seed}
								</p>
								<p
									className={cn(
										'truncate text-xs',
										candidate.error
											? 'text-destructive'
											: 'text-muted-foreground'
									)}
									aria-live="polite"
								>
									{describe(candidate, now)}
								</p>
							</div>
							{candidate.status === 'succeeded' && (
								<Button
									size="sm"
									variant="outline"
									disabled={loadingJobId !== null}
									onClick={() => void generation.loadCandidate(candidate.jobId)}
								>
									{loadingJobId === candidate.jobId ? 'Opening' : 'Open'}
								</Button>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	)
}
