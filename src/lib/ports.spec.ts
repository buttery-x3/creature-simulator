import { describe, expect, it } from 'vitest';
import { ports } from './ports';

describe('ports', () => {
	it('reserves the documented development, preview and browser-test ports', () => {
		expect(ports.development).toBe(8123);
		expect(ports.preview).toBe(8124);
		expect(ports.browserTest).toBe(8125);
	});

	it('keeps reserved ports unique', () => {
		const values = Object.values(ports);
		expect(new Set(values).size).toBe(values.length);
	});
});
