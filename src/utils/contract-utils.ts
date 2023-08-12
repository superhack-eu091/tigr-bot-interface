import fs from "fs";

const abiFolder = "./out/";

export const SAFE_DELEGATED_ERC721_PROXY_ABI = JSON.parse(
    fs.readFileSync(
        abiFolder +
            "SafeDelegatedERC721Proxy.sol/SafeDelegatedERC721Proxy.json",
        "utf8"
    )
).abi;
