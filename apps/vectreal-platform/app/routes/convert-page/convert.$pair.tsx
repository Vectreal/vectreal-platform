/**
 * One page per format pair.
 *
 * Modelled on `news-room/:slug`, the only other prerendered dynamic route here:
 * the concrete paths come from a manifest at config-load time, the loader
 * answers an unknown segment with a 404 Response, and `meta` is built entirely
 * from loader data.
 */
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { data } from 'react-router'

import { ConverterSurface } from '../../components/convert/converter-surface'
import {
	convertPairBySlug,
	convertPairPath
} from '../../lib/convert/convert-pairs'
import { buildPageMeta } from '../../lib/seo'

import type { Route } from './+types/convert.$pair'

export function loader({ params }: Route.LoaderArgs) {
	const pair = convertPairBySlug(params.pair)

	if (!pair) {
		throw new Response('Converter not found', { status: 404 })
	}

	return data(
		{ pair },
		{
			headers: {
				'Cache-Control':
					'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
			}
		}
	)
}

export function meta({ loaderData }: Route.MetaArgs) {
	if (!loaderData) {
		return buildPageMeta({
			title: 'Converter not found - Vectreal',
			description: 'This converter is not available.',
			canonical: '/publisher'
		})
	}

	const { pair } = loaderData

	return buildPageMeta({
		title: `${pair.title} - Vectreal`,
		description: pair.description,
		canonical: convertPairPath(pair)
	})
}

/*
  The heading, the description and the format switcher live in `convert-layout`, which
  derives them from the same manifest this route's loader reads. What is left
  here is the surface.

  NOTHING ELSE. This page carried `pair.note` and a per-pair `rationale` under
  the converter, which stacked four blocks of prose beneath a tool whose whole
  argument is that you can see it work. The note moved to where it is about
  something - beside the before-and-after it explains. The rationale went
  nowhere: the index it was said to read on had been regrouped by destination,
  which answers the same question once per format, so the field was dead and
  this comment was the record of a render site that no longer existed. It has
  been deleted; `CONVERT_TARGET_COPY` is where that sentence lives now.

  A LOADED MODEL SURVIVES A PAIR SWITCH, and that is the point of the switcher.
  Moving from `/convert/glb-to-gltf` to `/convert/glb-to-usdz` changes only the
  param, so this component and the `ModelProvider` below it stay mounted: the
  model stays on the stage and the download button retargets. Someone converting
  one file to several formats drops it once. Keying this component on the slug,
  or lifting the provider into the layout and remounting it, would both throw
  that away - so if either is ever tempting, this is what it costs.
*/
const ConvertPage = ({ loaderData }: Route.ComponentProps) => {
	const { pair } = loaderData
	const optimizer = useOptimizeModel()

	return (
		<ModelProvider optimizer={optimizer}>
			<ConverterSurface pair={pair} />
		</ModelProvider>
	)
}

export default ConvertPage
