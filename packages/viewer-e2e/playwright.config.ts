import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

// Base URL of the consumer preview server is injected by the orchestration
// script (run-e2e.ts) via E2E_BASE_URL after it builds + serves the throwaway
// app that installed @vctrl/viewer from the local registry.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4319'

export default defineConfig({
	testDir: './tests',
	// Keep Playwright artifacts inside the project (cwd is the workspace root
	// when invoked by the orchestrator), so the repo root stays clean.
	outputDir: join(__dirname, 'test-results'),
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI
		? [
				['github'],
				['list'],
				['html', { outputFolder: 'playwright-report', open: 'never' }]
			]
		: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// R3F needs a real WebGL context. Force the SwiftShader software
				// renderer so the canvas initializes in headless CI without a GPU.
				launchOptions: {
					args: [
						'--use-gl=angle',
						'--use-angle=swiftshader',
						'--enable-unsafe-swiftshader',
						'--ignore-gpu-blocklist'
					]
				}
			}
		}
	]
})
