import type { Preview } from '@storybook/react-vite'
import '../src/styles.css'

const preview: Preview = {
	parameters: {
		actions: { argTypesRegex: '^on[A-Z].*' },
		controls: {
			expanded: true,
			sort: 'requiredFirst'
		},
		layout: 'centered',
		docs: {
			controls: {
				sort: 'requiredFirst'
			}
		},
		options: {
			storySort: {
				order: ['Viewer', 'Components']
			}
		}
	},
	tags: ['autodocs']
}

export default preview
