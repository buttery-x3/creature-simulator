import { describe, expect, it } from 'vitest';
import { testCreature } from '../../test-creature';
import { reconsiderationTrigger } from './reconsideration';

const context = {
	incomingPendingTrigger: null,
	wildlifeChanged: false,
	perceptionChanged: false,
	dangerReplanned: false,
	emissionRequested: false
};

describe('recovery reconsideration scheduling', () => {
	it('only requests due-clock arbitration for an acute competing need', () => {
		const creature = testCreature({
			action: 'sleep',
			thirst: 1,
			energy: 0.5,
			nextReconsiderAt: 10
		});
		expect(reconsiderationTrigger(creature, 9.99, context)).toBeNull();
		expect(reconsiderationTrigger(creature, 10, context)).toBe('periodic');
		expect(reconsiderationTrigger({ ...creature, thirst: 0.9 }, 10, context)).toBeNull();
	});

	it.each(['eat', 'drink', 'sleep'] as const)(
		'does not interrupt %s for the need it is already recovering',
		(action) => {
			const creature = testCreature({
				action,
				hunger: action === 'eat' ? 1 : 0.2,
				thirst: action === 'drink' ? 1 : 0.2,
				energy: action === 'sleep' ? 0 : 0.8,
				nextReconsiderAt: 0
			});
			expect(reconsiderationTrigger(creature, 10, context)).toBeNull();
		}
	);

	it('does not duplicate danger arbitration or race an accepted emission', () => {
		const creature = testCreature({ action: 'eat', thirst: 1, nextReconsiderAt: 0 });
		expect(reconsiderationTrigger(creature, 10, { ...context, dangerReplanned: true })).toBeNull();
		expect(
			reconsiderationTrigger(creature, 10, { ...context, emissionRequested: true })
		).toBeNull();
	});

	it('does not let unrelated pending traffic bypass the recovery clock', () => {
		const creature = testCreature({ action: 'eat', thirst: 1, nextReconsiderAt: 20 });
		expect(
			reconsiderationTrigger(creature, 10, {
				...context,
				incomingPendingTrigger: 'new_heard_signal_memory'
			})
		).toBeNull();
	});
});
