import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { modelAcceptPattern } from '@vctrl/core/model-formats'

/**
 * The `accept` attribute for a file input that takes a model.
 *
 * WHY THIS LIVES IN THE APP AND NOT IN `@shared/components`. What a file input
 * may offer is a statement of what the loader can read, which is
 * `@vctrl/core`'s fact - and sitting in a UI kit that cannot depend on the
 * domain is exactly why it became one of the nine independent statements of
 * the accepted-format set. It listed `.usda`, which no loader has ever read, so
 * the picker let a file through that the loader then refused. It is derived now
 * and that entry is gone.
 *
 * On a phone the pattern is dropped entirely: iOS filters a `.glb` out of the
 * picker when the attribute is set, which leaves a reader with the right file
 * unable to select it. A wrong file is caught by the loader; an unselectable
 * right one is not recoverable from inside the app.
 */
const useAcceptPattern = (isMobileDefault?: boolean): string => {
	const isMobile = useIsMobile(isMobileDefault)

	return isMobile ? '*' : modelAcceptPattern()
}

export { useAcceptPattern }
