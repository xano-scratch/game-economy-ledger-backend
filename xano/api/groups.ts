import { apiGroup } from "@xanots/sdk";

// Pin each canonical slug so the public paths are stable (api:<canonical>/<name>)
// and getPath() resolves in the browser bundle without a lock file.
export const economyGroup = apiGroup({ name: "economy", canonical: "economy" });
export const authGroup = apiGroup({ name: "auth", canonical: "auth" });
export const adminGroup = apiGroup({ name: "admin", canonical: "admin" });
