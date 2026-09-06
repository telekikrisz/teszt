import { ujraertekelLezartKitoltesek } from "../services/kitoltesFlow.js";
import { pgClient } from "./index.js";

try {
  const n = await ujraertekelLezartKitoltesek();
  console.log(JSON.stringify({ ujraertekelve: n }));
} finally {
  await pgClient.end();
}
