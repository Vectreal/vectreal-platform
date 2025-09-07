// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  // ...rest of preview
  //👇 Enables auto-generated documentation for all stories
  tags: ['autodocs'],
};

export default preview;
