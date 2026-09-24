import { ConvertChooser } from '../../components/convert/convert-chooser'
import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH
} from '../../lib/convert/convert-pairs'
import { buildPageMeta } from '../../lib/seo'

export function meta() {
	return buildPageMeta({
		title: `${CONVERT_INDEX_COPY.title} - Vectreal`,
		description: CONVERT_INDEX_COPY.description,
		canonical: CONVERT_INDEX_PATH
	})
}

/**
 * The index is the chooser and nothing else: `ConvertChooser` says why it is
 * grouped the way it is.
 */
const ConvertIndexPage = () => <ConvertChooser />

export default ConvertIndexPage
