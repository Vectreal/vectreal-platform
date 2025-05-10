import { useIsMobile } from '.'

/**
 * Returns an accept pattern for use with the file input component.
 *
 * The returned value is either the default accept pattern for the file input component,
 * or a pattern that includes all the allowed file types if the user is using a mobile device.
 *
 * This is because the accept pattern does not correctly include files when trying to upload from an iphone.
 *
 * @returns The accept pattern for the file input component.
 */
const useAcceptPattern = (isMobileDefault: boolean): string => {
	const isMobile = useIsMobile(isMobileDefault)

	/**
	 * The default accept pattern for the file input component.
	 * This includes all the allowed file types.
	 */
	const acceptPattern =
		'model/gltf-binary,.glb,model/gltf+json,.gltf,.bin,model/vnd.usdz+zip,.usdz,model/vnd.usda,.usda,image/jpeg,.jpeg,.jpg,image/png,.png'

	return isMobile ? '*' : acceptPattern
}

export default useAcceptPattern
