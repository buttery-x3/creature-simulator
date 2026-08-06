import { defineConfig } from '@playwright/test';
import { ports } from './src/lib/ports.ts';

export default defineConfig({
	webServer: {
		// Use npm scripts so `node_modules/.bin` is on PATH (required on Windows shells).
		command: 'npm run build && npm run preview:e2e',
		port: ports.browserTest,
		reuseExistingServer: false,
		timeout: 180_000
	},
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL: `http://127.0.0.1:${ports.browserTest}`
	}
});
