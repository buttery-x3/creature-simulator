import type { Vec2 } from '$lib/habitat';

/** Innate visible display; never a learned symbol or a command. */
export type ExpressionKind = 'dance' | 'cry';
export type InnateExpression = {
	id: string;
	kind: ExpressionKind;
	startedAt: number;
	expiresAt: number;
	intensity: number;
};

/** Explicitly observable data only; identity requires local sight. */
export type PeerObservation = {
	/** Developmental appearance only, not fertility, age or private condition. */
	mature: boolean;
	id: string;
	position: Vec2;
	observedAt: number;
	expression: Pick<InnateExpression, 'id' | 'kind' | 'intensity'> | null;
};

export type Relationship = {
	peerId: string;
	familiarity: number;
	liking: number;
	lastSeenAt: number;
	lastExpressionId: string | null;
};

export type SocialState = {
	/** Last executed selected call plan; one per approach episode plus a cooldown. */
	movementCall: {
		peerId: string;
		intention: 'approach_peer' | 'court_peer';
		intentionStartedAt: number;
		timeSeconds: number;
	} | null;
	relationships: Relationship[];
	expression: InnateExpression | null;
	expressionSequence: number;
	nextExpressionAt: number;
	recentPain: number;
};

/** Derived welfare, not a persistent social-need meter. */
export type MoodSnapshot = {
	comfort: number;
	distress: number;
	positive: number;
	company: number;
	valence: number;
};
