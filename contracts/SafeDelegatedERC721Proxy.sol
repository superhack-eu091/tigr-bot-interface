// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface SafeDelegatedERC721ProxyInterface {
    function canSellNFT(address owner, address nft, uint256 tokenId, address spender) external view returns (bool, uint256);
    function canTransferNFT(address owner, address nft, uint256 tokenId, address spender) external view returns (bool);

    function sellNFT(address owner, address nft, uint256 tokenId, address destination) external payable;
    function transferNFT(address owner, address nft, uint256 tokenId, address destination) external;

    function setAllowance(
        address nft,
        uint256 tokenId,
        bool canBeSold,
        uint256 minPrice,
        address destination,
        bool canBeTransferred
    ) external;
}

contract SafeDelegatedERC721Proxy is SafeDelegatedERC721ProxyInterface {

    struct AllowanceInfo {
        bool canBeTransferred;

        bool canBeSold;
        uint256 minPrice;
    }

    mapping(bytes32 => AllowanceInfo) public allowances;

    function generateAllowanceKey(address owner, address nft, uint256 tokenId, address spender) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, nft, tokenId, spender));
    }

    function canSellNFT(address owner, address nft, uint256 tokenId, address spender) external view override returns (bool, uint256) {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, spender);
        return (allowances[key].canBeSold, allowances[key].minPrice);
    }

    function canTransferNFT(address owner, address nft, uint256 tokenId, address spender) external view override returns (bool) {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, spender);
        return allowances[key].canBeTransferred;
    }

    function sellNFT(address owner, address nft, uint256 tokenId, address destination) external payable override {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        require(allowances[key].canBeSold, "Not sellable");
        require(msg.value >= allowances[key].minPrice, "Insufficient payment");
        // Implicitly the caller is allowed to spend
        
        payable(owner).transfer(allowances[key].minPrice);

        ERC721 nftContract = ERC721(nft);
        nftContract.transferFrom(owner, destination, tokenId);

        delete allowances[key];
    }

    function transferNFT(address owner, address nft, uint256 tokenId, address destination) external override {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        require(allowances[key].canBeTransferred, "Not transferrable");
        // Implicitly the caller is allowed to send
        ERC721 nftContract = ERC721(nft);
        nftContract.transferFrom(owner, destination, tokenId);

        delete allowances[key];
    }

    function setAllowance(
        address nft,
        uint256 tokenId,
        bool canBeSold,
        uint256 minPrice,
        address destination,
        bool canBeTransferred
    ) external {
        if (minPrice > 0) {
            require(canBeSold, "Price requires selling permission");
        }

        address owner = msg.sender;
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        allowances[key] = AllowanceInfo({
            canBeSold: canBeSold,
            minPrice: minPrice,
            canBeTransferred: canBeTransferred
        });
    }
}