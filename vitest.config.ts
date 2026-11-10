import { defineConfig } from 'vitest/config';

// Existing date snapshots use this zone; keep test results portable across hosts.
process.env.TZ = 'America/Los_Angeles';

export default defineConfig({
	define: {
		DEBUG_MODE: false,
	},
	test: {
		include: ['src/**/*.test.ts'],
		globals: true,
		alias: {
			'webextension-polyfill': new URL('./src/utils/__mocks__/webextension-polyfill.ts', import.meta.url).pathname,
		},
	},
});
