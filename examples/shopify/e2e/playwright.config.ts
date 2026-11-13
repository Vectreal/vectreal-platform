import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

import { HARNESS_PORT } from './src/harness'

const CHROMIUM_ARGS = [
	'--use-angle=swiftshader',
	'--enable-unsafe-swiftshader',
	'--ignore-gpu-blocklist',
	// In process, so the network and CPU throttling reach the scene too.
	'--disable-site-isolation-trials',
	'--disable-features=IsolateOrigins,site-per-process'
]

const PHONE = { width: 390, height: 844 }

/*
  Runs the Shopify section against a real Vectreal embed, so it needs the
  platform's dev server on :4200 and SHOPIFY_HARNESS_EMBED_URL naming a
  published scene whose project allows 127.0.0.1. Local only: CI has neither.
  The horizon projects also download Horizon's source once (see src/horizon.ts).
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
			testIgnore: /horizon/,
			use: { ...devices['iPhone 15'] }
		},
		{
			name: 'android-chromium-throttled',
			testIgnore: /horizon/,
			use: { ...devices['Pixel 6a'], launchOptions: { args: CHROMIUM_ARGS } }
		},
		// Horizon (Savor's theme) at the 390 px of a small phone, and on desktop.
		{
			name: 'horizon-iphone-webkit',
			testMatch: /horizon/,
			use: { ...devices['iPhone 15'], viewport: PHONE }
		},
		{
			name: 'horizon-android-chromium',
			testMatch: /horizon/,
			use: {
				...devices['Pixel 6a'],
				viewport: PHONE,
				launchOptions: { args: CHROMIUM_ARGS }
			}
		},
		{
			name: 'horizon-desktop-chromium',
			testMatch: /horizon/,
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 1440, height: 900 },
				launchOptions: { args: CHROMIUM_ARGS }
			}
		}
	]
})
