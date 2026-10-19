/** The two factories of the `draco3d` package this subpath calls. It ships no types. */
declare module 'draco3d' {
	const draco3d: {
		createEncoderModule: (config?: object) => Promise<unknown>
		createDecoderModule: (config?: object) => Promise<unknown>
	}
	export default draco3d
}
