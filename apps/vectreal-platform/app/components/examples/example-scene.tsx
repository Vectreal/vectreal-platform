import { cn, formatFileSize } from '@shared/utils'
import { Rotate3d } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { useConsentedCapture } from '../../hooks/use-consented-capture'
import {
	exampleSceneById,
	publisherExampleHref
} from '../../lib/samples/example-scenes'
import { RenderFallbackBoundary } from '../errors/render-fallback-boundary'

import type { ReactNode } from 'react'

const ExampleSceneClient = lazy(() => import('./example-scene-client'))

interface Props {
	/** An id from `EXAMPLE_SCENES`. An unknown one fails the render, and so the prerender. */
	id: string
	/** Written the way an article captions an image: what the reader is looking at. */
	caption?: ReactNode
}

/**
 * A scene the reader can turn and then open in the publisher, for MDX pages:
 * newsroom articles and docs alike.
 *
 * It starts as a picture. The viewer, three.js and the model load only when
 * the reader asks, because most readers of a text page never will. The button
 * names the model's size, the one part of the download that varies by example;
 * the viewer, its decoder and the lighting come on top.
 */
export function ExampleScene({ id, caption }: Props) {
	const example = exampleSceneById(id)
	if (!example) {
		throw new Error(`Unknown example scene "${id}"`)
	}

	const [isActive, setIsActive] = useState(false)
	const frameRef = useRef<HTMLDivElement>(null)

	/*
	  The button that had focus is gone once the scene loads, so focus moves to
	  the frame that replaced it rather than falling back to the top of the page.
	*/
	useEffect(() => {
		if (isActive) frameRef.current?.focus()
	}, [isActive])
	const capture = useConsentedCapture()
	const { pathname } = useLocation()
	const track = (event: string) =>
		capture(event, { example: id, path: pathname })

	const poster = (
		<img
			src={example.previewUrl}
			alt=""
			className="absolute inset-0 m-auto h-3/4 w-3/4 object-contain"
		/>
	)

	return (
		<figure className="my-10">
			{/*
			  min-w-0 because the canvas has an intrinsic width and a grid or flex
			  item defaults to min-width: auto, so without it the page scrolls
			  sideways on a phone.
			*/}
			<div
				ref={frameRef}
				tabIndex={isActive ? -1 : undefined}
				role={isActive ? 'group' : undefined}
				aria-label={isActive ? `${example.label}. Drag to turn it.` : undefined}
				className="ds-sunken relative aspect-video w-full min-w-0 overflow-hidden rounded-2xl outline-none"
			>
				{isActive ? (
					/*
					  A failed viewer (no WebGL, a failed chunk) falls back to the
					  picture: the reader loses the 3D, not the page.
					*/
					<RenderFallbackBoundary fallback={poster}>
						<Suspense fallback={poster}>
							<ExampleSceneClient example={example} />
						</Suspense>
					</RenderFallbackBoundary>
				) : (
					<button
						type="button"
						onClick={() => {
							setIsActive(true)
							track('example_scene_activated')
						}}
						// Inset ring: the frame clips anything drawn outside the button.
						className="group absolute inset-0 h-full w-full rounded-2xl focus-visible:-outline-offset-4"
					>
						{poster}
						<span
							className={cn(
								'ds-raised text-foreground text-body-sm absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium',
								'transition-transform group-hover:scale-[1.03] motion-reduce:transition-none'
							)}
						>
							<Rotate3d className="h-4 w-4" />
							Load 3D scene
							<span className="text-muted-foreground font-normal tabular-nums">
								{formatFileSize(example.model.bytes)} model
							</span>
						</span>
						<span className="sr-only">: {example.label}</span>
					</button>
				)}
			</div>
			<figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
				{caption ? (
					<span className="text-muted-foreground text-body-sm italic">
						{caption}
					</span>
				) : null}
				<Link
					to={publisherExampleHref(id)}
					onClick={() => track('example_opened_in_publisher')}
					className="text-body-sm"
				>
					Open this scene in the Publisher
				</Link>
			</figcaption>
		</figure>
	)
}
