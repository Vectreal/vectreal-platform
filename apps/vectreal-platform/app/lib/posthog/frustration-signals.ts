import type { PostHogConfig } from 'posthog-js'

/**
 * What PostHog may count as a dead click or a rage click.
 *
 * A drag on a WebGL canvas ends in a `click`, because the press and the release
 * land on the same element. Orbiting a model repaints pixels and changes no DOM,
 * so posthog-js read every rotate or pan as a dead click (no scroll, selection or
 * mutation followed), and a few quick ones as a rage click. The publisher, where
 * people orbit constantly, reported hundreds of frustrated clicks per session
 * that the replay showed to be ordinary use.
 *
 * Both detectors walk from the click target up to the root and skip the click
 * when any element on that chain matches the list. `canvas` matches only the
 * canvas itself, so the viewer's overlay buttons, which are its siblings, still
 * report. A list replaces posthog-js's default rather than extending it, so the
 * default classes are repeated here.
 *
 * Passing an object for `capture_dead_clicks` also turns dead-click capture on
 * regardless of the project's remote setting (posthog-js 1.414.0).
 */
export const RAGECLICK_CONFIG = {
	css_selector_ignorelist: ['.ph-no-rageclick', '.ph-no-capture', 'canvas']
} satisfies PostHogConfig['rageclick']

export const DEAD_CLICKS_CONFIG = {
	css_selector_ignorelist: ['.ph-no-deadclick', '.ph-no-capture', 'canvas']
} satisfies PostHogConfig['capture_dead_clicks']
