/**
 * `/view?src=<url>`: open a model from a link, with no account.
 *
 * No loader. The link is never read on the server, so nothing it says reaches
 * the server-rendered HTML, and the model's bytes travel from its host to the
 * visitor's browser without passing through ours.
 */
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'

import {
	VIEW_PAGE_DESCRIPTION,
	ViewSurface
} from '../../components/view/view-surface'
import { buildPageMeta } from '../../lib/seo'

import type { Route } from './+types/view-page'

export function meta({ location }: Route.MetaArgs) {
	/*
	  The page with a link in it shows somebody else's file under our domain, so
	  it is never indexed. The bare page is the front door and is.
	*/
	const opensLink = new URLSearchParams(location.search).has('src')

	return buildPageMeta(
		{
			title: 'View a 3D model online - Vectreal',
			description: VIEW_PAGE_DESCRIPTION,
			canonical: '/view'
		},
		undefined,
		{ private: opensLink }
	)
}

/*
  The optimizer is here for the Publisher handoff alone: it serializes the
  optimizer's document, so the optimizer has to hold the model on screen.
*/
export default function ViewPage() {
	const optimizer = useOptimizeModel()

	return (
		<ModelProvider optimizer={optimizer}>
			<ViewSurface />
		</ModelProvider>
	)
}
