import { runOnboarding } from "./src/profiles/onboarding";

// In-memory storage for simplicity; consider using a database for persistent storage.
const userEthAddresses: Record<number, string> = {};
const activeNetwork: Record<number, string> = {};

runOnboarding(userEthAddresses, activeNetwork);
