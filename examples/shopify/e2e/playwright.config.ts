import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

import { HARNESS_PORT } from './src/harness'

/*
  Runs the Shopify section against a real Vectreal embed, so it needs the
  platform's dev server on :4200 and SHOPIFY_HARNESS_EMBED_URL naming a
  published scene whose project allows 127.0.0.1. Local only: CI has neither.
*/
export default defineConfig({
	testDir: './tests',
	outputDir: join(__dirname, 'test-results'),
	timeout: 180_000,
	expect: { timeout: 60_000 },
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: `http://127.0.0.1:${HARNESS_PORT}`,
		video: 'on',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'node examples/shopify/e2e/src/server.ts',
		cwd: join(__dirname, '../../..'),
		url: `http://127.0.0.1:${HARNESS_PORT}/`,
		reuseExistingServer: true
	},
	projects: [
		{
			name: 'iphone-webkit',
			use: { ...devices['iPhone 15'] }
		},
		{
			name: 'android-chromium-throttled',
			use: {
				...devices['Pixel 6a'],
				launchOptions: {
					args: [
						'--use-angle=swiftshader',
						'--enable-unsafe-swiftshader',
						'--ignore-gpu-blocklist',
						// In process, so the network and CPU throttling reach the scene too.
						'--disable-site-isolation-trials',
						'--disable-features=IsolateOrigins,site-per-process'
					]
				}
			}
		}
	]
})
