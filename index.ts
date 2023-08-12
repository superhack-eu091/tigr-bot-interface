import { runOnboarding } from "./src/profiles/onboarding";
import { runNFTs } from "./src/profiles/nfts";
import { runTrending } from "./src/profiles/trending";
import { runNftPurchase } from "./src/profiles/nft-purchase";
import { SupportedNetworks } from "./src/config/network-config";
import { SupportedTrendingPeriods } from "./src/config/trending-config";

// In-memory storage for simplicity; consider using a database for persistent storage.
const userEthAddresses: Record<number, string> = {};
const activeNetwork: Record<number, SupportedNetworks> = {};
const selectedTrendingPeriod: Record<number, SupportedTrendingPeriods> = {};

runOnboarding(userEthAddresses, activeNetwork);
runNFTs(activeNetwork, selectedTrendingPeriod);
runTrending(activeNetwork, selectedTrendingPeriod);
runNftPurchase(userEthAddresses, activeNetwork).then(() => {});
