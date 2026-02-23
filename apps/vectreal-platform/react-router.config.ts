import type { Config } from '@react-router/dev/config'

export default {
	ssr: true,
	buildDirectory: '../../build/apps/vectreal-platform',

	future: {
		v8_viteEnvironmentApi: true,
		v8_middleware: true
	}
} satisfies Config
