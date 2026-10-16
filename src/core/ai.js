// The computer opponent: aiPlan decides the shot, aiIntents plays it out like a human would.
import { aiPlan } from './ai-plan.js';
import { aiIntents } from './ai-intents.js';

export { aiPlan, aiIntents };

export const createAi = () => ({ plan: null, elapsed: 0 });

// One tick of the computer's turn: plan once when its aim phase starts, then play the plan out.
// ai = createAi(). A turn only ends through 'settling', which the computer's own turn always
// ticks through, so that is where the spent plan is dropped.
export function aiTick(ai, world, dt, rng) {
  const phase = world.turn.phase;
  if (phase === 'settling') ai.plan = null;
  if (phase === 'aim' && !ai.plan) {
    ai.plan = aiPlan(world, rng);
    ai.elapsed = 0;
  }
  if (!ai.plan || (phase !== 'aim' && phase !== 'retreat')) return {};
  ai.elapsed += dt;
  return aiIntents(ai.plan, ai.elapsed, world);
}
