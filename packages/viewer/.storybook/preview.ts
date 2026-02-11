// Replace your-renderer with the renderer you are using (e.g., react, vue3)

import { definePreview } from '@storybook/react-vite'

const preview = definePreview({
	// ...rest of preview
	//👇 Enables auto-generated documentation for all stories
	tags: ['autodocs']
})

export default preview
