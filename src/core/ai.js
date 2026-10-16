// The computer opponent: aiPlan decides the shot, aiIntents plays it out like a human would.
import { aiPlan } from './ai-plan.js';
import { aiIntents } from './ai-intents.js';

export { aiPlan, aiIntents };

// One tick of the computer's turn: plan once when its aim phase starts, then play the plan out.
// ai = { plan, elapsed }; the caller sets plan to null whenever a new turn begins.
export function aiTick(ai, world, dt, rng) {
  const phase = world.turn.phase;
  if (phase === 'aim' && !ai.plan) {
    ai.plan = aiPlan(world, rng);
    ai.elapsed = 0;
  }
  if (!ai.plan || (phase !== 'aim' && phase !== 'retreat')) return {};
  ai.elapsed += dt;
  return aiIntents(ai.plan, ai.elapsed, world);
}
