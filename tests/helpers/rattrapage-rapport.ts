// globalSetup de vitest.slow-rattrapage.config.ts : fixe le commit mesuré pour toute la série (les fichiers
// lents le lisent dans RATTRAPAGE_COMMIT), puis, après les deux fichiers, imprime le rapport complet du
// rattrapage (tests/helpers/rattrapage.ts), une seule fois.
import { currentCommit, rattrapageReport } from './rattrapage';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;

export default function setup(): () => void {
  env.RATTRAPAGE_COMMIT ??= currentCommit();
  return () => {
    console.log(rattrapageReport());
  };
}
