// Empreinte par pas (plan B, tâche 5f) : sha1 des flottants bruts (Float64) de toutes les pièces de
// toutes les voitures et du temps de course. Juge le « au bit près » de Galahad seul.
import type { RaceSim } from '../../src/sim/simulate';

/** sha1 de node:crypto, par `process.getBuiltinModule` (le projet n'a pas @types/node, cf. phases.ts). */
interface Hash { update(data: Uint8Array | string): Hash; digest(encoding: 'hex'): string }
const createHash = (algo: 'sha1'): Hash => (globalThis as unknown as {
  process: { getBuiltinModule(id: 'node:crypto'): { createHash(a: string): Hash } };
}).process.getBuiltinModule('node:crypto').createHash(algo);

/** sha1 (hex) des Float64 bruts du pas : pour chaque pièce, position, angle, vitesse, vitesse angulaire ; puis `sim.time`. */
export function stepFingerprint(sim: RaceSim): string {
  const values: number[] = [];
  for (const car of sim.cars) {
    for (const p of car.body.parts) {
      values.push(p.position.x, p.position.y, p.angle, p.velocity.x, p.velocity.y, p.angularVelocity);
    }
  }
  values.push(sim.time);
  return createHash('sha1').update(new Uint8Array(Float64Array.from(values).buffer)).digest('hex');
}

/** sha1 cumulé : empreintes de chaque pas enchaînées, dans l'ordre. */
export class CumulativeFingerprint {
  private readonly hash = createHash('sha1');
  steps = 0;

  push(sim: RaceSim): void {
    this.hash.update(stepFingerprint(sim));
    this.steps++;
  }

  digest(): string {
    return this.hash.digest('hex');
  }
}
