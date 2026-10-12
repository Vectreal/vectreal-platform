import { IMPORTABLE_FORMAT_LABELS } from '@vctrl/core/model-formats'

/** Where the viewer lives, for the pages that link to it. */
export const VIEW_PAGE_PATH = '/view'

/** "GLB, glTF, STL, FBX or OBJ", from the format owner. */
export const FORMAT_LIST = new Intl.ListFormat('en', {
	type: 'disjunction'
}).format(IMPORTABLE_FORMAT_LABELS)

/**
 * The page's promise in one line, shared by its hero, its meta tags and an
 * article's closing panel. Apart from the page so those can read it without
 * bundling the viewer.
 */
export const VIEW_PAGE_DESCRIPTION = `Drop a ${FORMAT_LIST} file, or paste a link to one. It opens in your browser, with no upload and no account.`
