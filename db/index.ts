import { khoraDb } from "./postgres";

export { khoraDb } from "./postgres";

export function getDb() {
  return khoraDb;
}
