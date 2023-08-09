export interface ILoadConfig {
    account: string;
    network: string;
}

interface IBaseCommands {
    START: RegExp;
    LOAD_CONFIG: RegExp;
}

interface IChainCommands {
    GET_ACCOUNT: RegExp;
    SET_ACCOUNT: RegExp;
    GET_NETWORK: RegExp;
    SET_NETWORK: RegExp;
    ACCOUNT_BALANCE: RegExp;
}

interface IBaseCommandReferences {
    START: string;
    LOAD_CONFIG: string;
}

interface IChainCommandReferences {
    GET_ACCOUNT: string;
    SET_ACCOUNT: string;
    GET_NETWORK: string;
    SET_NETWORK: string;
    ACCOUNT_BALANCE: string;
}

export const base_commands: IBaseCommands = {
    START: /\/start/,
    LOAD_CONFIG: /\/load_config (.+)/,
};

export const chain_commands: IChainCommands = {
    GET_ACCOUNT: /\/account/,
    SET_ACCOUNT: /\/set_account (.+)/,
    GET_NETWORK: /\/network/,
    SET_NETWORK: /\/set_network (.+)/,
    ACCOUNT_BALANCE: /\/balance/,
};

export const base_command_references: IBaseCommandReferences = {
    START: "/start",
    LOAD_CONFIG: "/load_config",
};

export const chain_command_references: IChainCommandReferences = {
    GET_ACCOUNT: "/account",
    SET_ACCOUNT: "/set_account",
    GET_NETWORK: "/network",
    SET_NETWORK: "/set_network",
    ACCOUNT_BALANCE: "/balance",
};
