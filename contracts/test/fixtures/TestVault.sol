// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract TestAsset {
    mapping(address => uint256) public balanceOf;

    function mint(address owner, uint256 amount) external {
        balanceOf[owner] += amount;
    }
}

/// @dev Deliberately controllable test fixture, never a deployment candidate.
contract TestVault {
    address public asset;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public payout = 100;
    bool public lie;
    address public callback;
    bytes public callbackData;

    constructor(address token) {
        asset = token;
    }

    function mint(address owner, uint256 shares) external {
        balanceOf[owner] += shares;
    }

    function approve(address spender, uint256 shares) external {
        allowance[msg.sender][spender] = shares;
    }

    function setPayout(uint256 amount, bool fake) external {
        payout = amount;
        lie = fake;
    }

    function setAsset(address token) external {
        asset = token;
    }

    function setCallback(address target, bytes calldata data) external {
        callback = target;
        callbackData = data;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256) {
        require(allowance[owner][msg.sender] >= shares, "allowance");
        allowance[owner][msg.sender] -= shares;
        balanceOf[owner] -= shares;
        if (callback != address(0)) {
            (bool success,) = callback.call(callbackData);
            require(!success, "reentry succeeded");
        }
        if (!lie) TestAsset(asset).mint(receiver, payout);
        return payout;
    }
}
