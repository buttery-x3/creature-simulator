/**
 * Reserved local ports for this repository.
 *
 * Keep package scripts, Vite config, Playwright config and docs aligned with these values.
 * Commands must use strict port binding so an occupied port fails clearly.
 */
export const ports = {
	/** `npm run dev` */
	development: 8123,
	/** `npm run preview` */
	preview: 8124,
	/** `npm run test:e2e` (Playwright webServer) */
	browserTest: 8125
} as const;

export type ReservedPortName = keyof typeof ports;
export type ReservedPort = (typeof ports)[ReservedPortName];
