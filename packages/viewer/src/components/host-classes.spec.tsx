// @vitest-environment jsdom
/**
 * A host's `className` on the viewer and its exported controls replaces the
 * viewer classes it overrides, rather than sitting beside them and losing to
 * the viewer's unlayered stylesheet. `class-names.spec.ts` holds the rule;
 * this holds every place a host's class enters.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AnimationControls from './animation-controls'
import CameraControls from './camera-controls'
import {
	InfoPopover,
	InfoPopoverCloseButton,
	InfoPopoverContent,
	InfoPopoverText,
	InfoPopoverTrigger
} from './info-popover'

const classesOf = (element: Element | null) =>
	(element?.getAttribute('class') ?? '').split(' ')

describe('a host class on an exported control', () => {
	it('replaces the playback bar padding it overrides', () => {
		const { container } = render(
			<AnimationControls
				playing={false}
				complete={false}
				onToggle={() => undefined}
				onRestart={() => undefined}
				className="p-3"
			/>
		)
		const root = classesOf(container.firstElementChild)
		expect(root).toContain('p-3')
		expect(root).not.toContain('vv:p-1')
		expect(root).toContain('vv:flex')
	})

	it('replaces the camera switcher padding it overrides', () => {
		const { container } = render(
			<CameraControls
				cameras={[{ cameraId: 'front', name: 'Front' }]}
				activeCameraId="front"
				onSelect={() => undefined}
				className="p-3"
			/>
		)
		const root = classesOf(container.firstElementChild)
		expect(root).toContain('p-3')
		expect(root).not.toContain('vv:p-1')
	})

	it('replaces what it overrides on every info popover part', () => {
		const { container } = render(
			<InfoPopover className="m-6">
				<InfoPopoverTrigger className="p-3" />
				<InfoPopoverContent className="left-4">
					<InfoPopoverText className="p-8">Text</InfoPopoverText>
					<InfoPopoverCloseButton className="m-0" />
				</InfoPopoverContent>
			</InfoPopover>
		)
		const part = (selector: string) =>
			classesOf(container.querySelector(selector))
		expect(part('.vctrl-viewer-info-popover')).not.toContain('vv:m-2')
		expect(part('.vctrl-viewer-info-popover-trigger')).not.toContain('vv:p-1')
		expect(part('.vctrl-viewer-info-popover-modal')).not.toContain('vv:left-0')
		expect(part('[role="dialog"] > div')).not.toContain('vv:p-4')
		expect(
			classesOf(container.querySelector('[role="dialog"] button'))
		).not.toContain('vv:m-2')
	})
})

describe("a host class on the viewer's root", () => {
	const source = (...path: string[]) =>
		readFileSync(join(import.meta.dirname, '..', ...path), 'utf8')

	it('goes through the host merge in the viewer and its canvas wrapper', () => {
		expect(source('vectreal-viewer.tsx')).toMatch(
			/containerClassName=\{withHostClasses\(\s*'viewer vctrl-viewer[^']*',\s*className\s*\)\}/
		)
		expect(source('components', 'canvas-wrapper.tsx')).toMatch(
			/className=\{withHostClasses\(\s*cn\('vv:outline-none', colorScheme\),\s*containerClassName\s*\)\}/
		)
	})

	it('goes through the host merge on the loading thumbnail', () => {
		expect(source('components', 'loading-thumbnail-backdrop.tsx')).toMatch(
			/withHostClasses\([\s\S]*?\),\s*thumbnail\.className\s*\)/
		)
	})
})
