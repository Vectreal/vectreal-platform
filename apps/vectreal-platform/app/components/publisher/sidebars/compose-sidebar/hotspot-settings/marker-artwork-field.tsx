import { Button } from '@shared/components/ui/button'
import { ImageUp } from 'lucide-react'
import { useRef, useState } from 'react'

import { useHotspotEdits } from './use-hotspot-edits'
import {
	canUploadHotspotArtwork,
	HOTSPOT_ARTWORK_MAX_BYTES,
	HOTSPOT_INLINE_ARTWORK_MAX_KB
} from '../../../../../lib/domain/scene/hotspot-artwork'
import {
	HOTSPOT_IMAGE_MEDIA_TYPES,
	isAllowedHotspotPayloadUrl
} from '../../../../../lib/domain/scene/hotspot-urls'
import { SettingGroup } from '../../sidebar-section'

import type { HotspotDefinition } from '@vctrl/core'

const MAX_MB = HOTSPOT_ARTWORK_MAX_BYTES / (1024 * 1024)

const readAsDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})

/**
 * What the stored value is, in the words an author would use. A remote address
 * is named by its host: it predates uploads and keeps working until replaced.
 */
function describeArtwork(payloadUrl: string): string {
	if (payloadUrl.startsWith('data:') || payloadUrl.startsWith('/api/')) {
		return 'Uploaded image'
	}
	try {
		return `Linked from ${new URL(payloadUrl).host}`
	} catch {
		return 'Linked image'
	}
}

/**
 * A marker's image, uploaded rather than linked.
 *
 * A remote address made every embed visitor's browser call a host the author
 * chose, so artwork now comes from a file. Picking one keeps it on the marker
 * as an inline image, which previews at once and survives the draft; the save
 * uploads it to the scene (`persistHotspotArtwork`). A remote address saved
 * before this keeps working, and says so, until it is replaced.
 */
export function MarkerArtworkField({
	hotspot
}: {
	hotspot: HotspotDefinition
}) {
	const edits = useHotspotEdits()
	const inputRef = useRef<HTMLInputElement>(null)
	const [error, setError] = useState<string | null>(null)
	const errorId = `hotspot-artwork-error-${hotspot.id}`
	const payloadUrl = hotspot.payloadUrl
	const isRemote = !!payloadUrl?.toLowerCase().startsWith('https://')

	const pick = async (file: File | undefined) => {
		if (!file) return
		if (!HOTSPOT_IMAGE_MEDIA_TYPES.includes(file.type)) {
			setError('Use a PNG, JPEG, WebP, GIF or SVG image.')
			return
		}
		if (file.size > HOTSPOT_ARTWORK_MAX_BYTES) {
			setError(`Use an image under ${MAX_MB} MB.`)
			return
		}
		let dataUrl: string
		try {
			dataUrl = await readAsDataUrl(file)
		} catch {
			setError('That image could not be read. Pick it again.')
			return
		}
		// Too large to stay inline, it is uploaded on save, and only the types
		// the asset route serves as images can be.
		if (
			!isAllowedHotspotPayloadUrl(dataUrl) &&
			!canUploadHotspotArtwork(file.type)
		) {
			setError(
				`Use an SVG or GIF under ${HOTSPOT_INLINE_ARTWORK_MAX_KB} KB, or a PNG, JPEG or WebP image.`
			)
			return
		}
		setError(null)
		edits.update(hotspot.id, { payloadUrl: dataUrl })
	}

	return (
		<SettingGroup
			label="Image"
			description={
				isRemote
					? 'Saved before images were uploaded. Replace it to keep the marker loading from the scene itself.'
					: undefined
			}
		>
			{payloadUrl && (
				<div className="flex min-w-0 items-center gap-3">
					<img
						src={payloadUrl}
						alt=""
						className="ds-raised size-10 shrink-0 rounded-full object-cover"
					/>
					<p className="text-muted-foreground min-w-0 truncate text-xs">
						{describeArtwork(payloadUrl)}
					</p>
				</div>
			)}

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="gap-1.5"
					aria-describedby={error ? errorId : undefined}
					onClick={() => inputRef.current?.click()}
				>
					<ImageUp aria-hidden className="size-3.5" />
					{payloadUrl ? 'Replace image' : 'Upload image'}
				</Button>
				{payloadUrl && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setError(null)
							edits.update(hotspot.id, { payloadUrl: undefined })
						}}
					>
						Remove
					</Button>
				)}
			</div>

			<p id={errorId} aria-live="polite" className="text-destructive text-xs">
				{error}
			</p>

			<input
				ref={inputRef}
				type="file"
				accept={HOTSPOT_IMAGE_MEDIA_TYPES.join(',')}
				aria-label="Marker image file"
				className="hidden"
				tabIndex={-1}
				onChange={(event) => {
					void pick(event.target.files?.[0])
					// Cleared, so picking the same file again still fires a change.
					event.target.value = ''
				}}
			/>
		</SettingGroup>
	)
}
