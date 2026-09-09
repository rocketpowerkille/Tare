// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Local indexing fixtures only. These deliberately have unrestricted test methods.
contract IndexingControl {
    address public constant asset = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant MORPHO = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;
    uint8 public constant decimals = 18;
    uint8 public constant DECIMALS_OFFSET = 12;
    uint256 public constant fee = 0;
    uint256 public constant lastTotalAssets = 100;
    uint256 public constant totalAssets = 100;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint256 value);

    function withdrawQueueLength() external pure returns (uint256) { return 1; }
    function withdrawQueue(uint256 index) external pure returns (bytes32) {
        require(index == 0);
        return bytes32(uint256(1));
    }
    function mint(address receiver, uint256 shares) external {
        totalSupply += shares;
        balanceOf[receiver] += shares;
        emit Transfer(address(0), receiver, shares);
    }
    function burn(uint256 shares) external {
        totalSupply -= shares;
        balanceOf[msg.sender] -= shares;
        emit Transfer(msg.sender, address(0), shares);
    }
    function transfer(address receiver, uint256 shares) external returns (bool) {
        balanceOf[msg.sender] -= shares;
        balanceOf[receiver] += shares;
        emit Transfer(msg.sender, receiver, shares);
        return true;
    }
}

contract BlueControl {
    function idToMarketParams(bytes32) external pure returns (address, address, address, address, uint256) {
        return (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48, address(0), address(0), address(0), 0);
    }
    function market(bytes32) external pure returns (uint128, uint128, uint128, uint128, uint128, uint128) {
        return (100, 100000000, 0, 0, 1, 0);
    }
    function position(bytes32, address) external pure returns (uint256, uint128, uint128) {
        return (100000000, 0, 0);
    }
}
