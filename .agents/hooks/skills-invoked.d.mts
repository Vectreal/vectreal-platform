/**
 * Types for the hook module, which stays plain JavaScript so it runs under
 * node with no build step. The spec in apps/vectreal-platform/tests imports it.
 */
export declare const SKILLS: Record<string, string>
export declare const WORK_ITEMS_HEADING: RegExp
export declare function skillsInvoked(transcriptPath: string | undefined): Set<string> | null
export declare function planCarriesWorkItems(transcriptPath: string | undefined): boolean | null
export declare function readPayload(): Promise<Record<string, unknown>>
