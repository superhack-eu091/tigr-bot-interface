// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface NFTProxyInterface {
    function canSellNFT(
        address owning_user_address,
        address address_of_NFT
    ) external view returns (bool, uint256);

    function canTransferNFT(
        address owning_user_address,
        address address_of_NFT,
        address dest_address
    ) external view returns (bool);

    function sellNFT(
        address owning_user_address,
        address address_of_NFT,
        address destination_for_NFT
    ) external payable;

    function transferNFT(
        address owning_user_address,
        address address_of_NFT,
        address dest_address
    ) external;
}
