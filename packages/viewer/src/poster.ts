/**
 * The poster a scene shows before a visitor asks for it.
 *
 * A separate entry point because the package root pulls in the viewer itself -
 * React Three Fiber, three and drei - so a page that shows a poster first would
 * download all of that before anybody pressed it. This entry imports React and
 * the viewer's words and stylesheet, nothing that draws in 3D.
 */
import './styles.css'
import './utilities.css'

export {
	ViewerPoster,
	type ViewerPosterProps,
	type ViewerPosterState
} from './components/viewer-poster'
