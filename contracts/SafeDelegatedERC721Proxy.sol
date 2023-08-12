// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ISafeDelegatedERC721Proxy} from "./interfaces/ISafeDelegatedERC721Proxy.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/interfaces/IERC721.sol";

interface IERC721Receiver {
    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract SafeDelegatedERC721Proxy is
    ISafeDelegatedERC721Proxy,
    IERC721Receiver
{
    mapping(bytes32 => AllowanceInfo) public allowances;

    function generateAllowanceKey(
        address owner,
        address nft,
        uint256 tokenId,
        address spender
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, nft, tokenId, spender));
    }

    function canSellNFT(
        address owner,
        address nft,
        uint256 tokenId,
        address spender
    ) external view override returns (bool, uint256) {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, spender);
        return (allowances[key].canBeSold, allowances[key].minPrice);
    }

    function canTransferNFT(
        address owner,
        address nft,
        uint256 tokenId,
        address spender
    ) external view override returns (bool) {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, spender);
        return allowances[key].canBeTransferred;
    }

    function sellNFT(
        address owner,
        address nft,
        uint256 tokenId,
        address destination
    ) external payable override {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        require(allowances[key].canBeSold, "Not sellable");
        require(msg.value >= allowances[key].minPrice, "Insufficient payment");
        // Implicitly the caller is allowed to spend

        payable(owner).transfer(allowances[key].minPrice);

        IERC721 nftContract = IERC721(nft);
        nftContract.transferFrom(owner, destination, tokenId);

        delete allowances[key];
    }

    function transferNFT(
        address owner,
        address nft,
        uint256 tokenId,
        address destination
    ) external override {
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        require(allowances[key].canBeTransferred, "Not transferrable");
        // Implicitly the caller is allowed to send
        IERC721 nftContract = IERC721(nft);
        nftContract.transferFrom(owner, destination, tokenId);

        delete allowances[key];
    }

    function setAllowance(
        address nft,
        uint256 tokenId,
        uint256 minPrice,
        address destination,
        bool canBeTransferred
    ) external {
        address owner = msg.sender;
        bytes32 key = generateAllowanceKey(owner, nft, tokenId, destination);

        allowances[key] = AllowanceInfo({
            canBeSold: minPrice > 0,
            minPrice: minPrice,
            canBeTransferred: canBeTransferred
        });
    }

    /**
     * @dev See {IERC721Receiver-onERC721Received}.
     *
     * Always returns `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
