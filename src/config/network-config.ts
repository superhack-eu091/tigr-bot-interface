import dotenv from "dotenv";
dotenv.config();

export enum SupportedNetworks {
    ETHEREUM_MAINNET = "ethereum_mainnet",
    ETHEREUM_SEPOLIA = "ethereum_sepolia",
    OPTIMISM_MAINNET = "optimism_mainnet",
    OPTIMISM_GOERLI = "optimism_goerli",
    BASE_MAINNET = "base_mainnet",
    BASE_GOERLI = "base_goerli",
    ZORA_MAINNET = "zora_mainnet",
    ZORA_GOERLI = "zora_goerli",
}

interface INetworkUrls {
    ETHEREUM_SEPOLIA: string;
    OPTIMISM_MAINNET: string;
    OPTIMISM_GOERLI: string;
    BASE_MAINNET: string;
    BASE_GOERLI: string;
    ZORA_MAINNET: string;
    ZORA_GOERLI: string;
    LOCALHOST: string;
}

export const network_urls: INetworkUrls = {
    ETHEREUM_SEPOLIA: process.env.ETHEREUM_SEPOLIA as string,
    OPTIMISM_MAINNET: process.env.OPTIMISM_MAINNET as string,
    OPTIMISM_GOERLI: process.env.OPTIMISM_GOERLI as string,
    BASE_MAINNET: process.env.BASE_MAINNET as string,
    BASE_GOERLI: process.env.BASE_GOERLI as string,
    ZORA_MAINNET: process.env.ZORA_MAINNET as string,
    ZORA_GOERLI: process.env.ZORA_GOERLI as string,
    LOCALHOST: "http://localhost:8545",
};

const explorer_urls = {
    ETHEREUM_SEPOLIA: "https://sepolia.etherscan.io/",
    OPTIMISM_MAINNET: "https://optimistic.etherscan.io/",
    OPTIMISM_GOERLI: "https://goerli-optimism.etherscan.io/",
    BASE_MAINNET: "https://base.blockscout.com/",
    BASE_GOERLI: "https://eth-goerli.blockscout.com/",
    ZORA_MAINNET: "https://explorer.zora.energy",
    ZORA_GOERLI: "",
    LOCALHOST: "",
};

export const networkUrl = (
    network: string,
    fallback: boolean = true
): string => {
    switch (network) {
        case SupportedNetworks.ETHEREUM_SEPOLIA:
            return network_urls.ETHEREUM_SEPOLIA;
        case SupportedNetworks.OPTIMISM_MAINNET:
            return network_urls.OPTIMISM_MAINNET;
        case SupportedNetworks.OPTIMISM_GOERLI:
            return network_urls.OPTIMISM_GOERLI;
        case SupportedNetworks.BASE_MAINNET:
            return network_urls.BASE_MAINNET;
        case SupportedNetworks.BASE_GOERLI:
            return network_urls.BASE_GOERLI;
        case SupportedNetworks.ZORA_MAINNET:
            return network_urls.ZORA_MAINNET;
        case SupportedNetworks.ZORA_GOERLI:
            return network_urls.ZORA_GOERLI;
        default:
            return fallback ? network_urls.LOCALHOST : "";
    }
};

export const addressExplorerUrl = (
    network: string | null,
    address: string,
    fallback: boolean = true
): string => {
    switch (network) {
        case SupportedNetworks.ETHEREUM_SEPOLIA:
            return `<a href="${explorer_urls.ETHEREUM_SEPOLIA}/address/${address}">${address}</a>`;
        case SupportedNetworks.OPTIMISM_MAINNET:
            return `<a href="${explorer_urls.OPTIMISM_MAINNET}/address/${address}">${address}</a>`;
        case SupportedNetworks.OPTIMISM_GOERLI:
            return `<a href="${explorer_urls.OPTIMISM_GOERLI}/address/${address}">${address}</a>`;
        case SupportedNetworks.BASE_MAINNET:
            return `<a href="${explorer_urls.BASE_MAINNET}/address/${address}">${address}</a>`;
        case SupportedNetworks.BASE_GOERLI:
            return `<a href="${explorer_urls.BASE_GOERLI}/address/${address}">${address}</a>`;
        case SupportedNetworks.ZORA_MAINNET:
            return `<a href="${explorer_urls.ZORA_MAINNET}/address/${address}">${address}</a>`;
        case SupportedNetworks.ZORA_GOERLI:
            return `<a href="${explorer_urls.ZORA_GOERLI}/address/${address}">${address}</a>`;
        default:
            return fallback
                ? `<a href="${explorer_urls.LOCALHOST}/address/${address}">${address}</a>`
                : address;
    }
};
