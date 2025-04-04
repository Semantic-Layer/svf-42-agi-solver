// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockMaster42 {
    struct Message {
        address sender;
        string message;
        uint256 timestamp;
        bool processed;
    }

    mapping(uint256 => Message) public messages;
    uint256 public nextMessageId = 1;
    
    // Add AI address
    address public immutable ai;

    event MessageSent(
        address indexed user,
        uint256 indexed messageId,
        string message,
        uint256 timestamp
    );

    event MessageResponse(
        uint256 indexed messageId,
        uint8 action,
        address tokenAddress,
        uint256 amount,
        string response
    );

    constructor(address ai_) {
        ai = ai_;
    }

    function sendMessage(string calldata message) external {
        uint256 messageId = nextMessageId++;
        messages[messageId] = Message({
            sender: msg.sender,
            message: message,
            timestamp: block.timestamp,
            processed: false
        });

        emit MessageSent(msg.sender, messageId, message, block.timestamp);
    }

    function respond(
        uint256 messageId,
        uint8 action,
        address tokenAddress,
        uint256 amount,
        string calldata response
    ) external {
        require(msg.sender == ai, "Only AI can respond");
        require(messages[messageId].sender != address(0), "Message does not exist");
        messages[messageId].processed = true;
        emit MessageResponse(messageId, action, tokenAddress, amount, response);
    }

    // Add this function to match the interface
    function checkMessageResponded(uint256 messageId) external view returns (bool) {
        return messages[messageId].processed;
    }

    // Add this function to match the interface
    function getProcessedTasks(uint256 start, uint256 end) external view returns (uint256[] memory) {
        uint256[] memory processed = new uint256[](end - start);
        uint256 count = 0;
        for(uint256 i = start; i < end; i++) {
            if(messages[i].processed) {
                processed[count] = i;
                count++;
            }
        }
        return processed;
    }

    // Add this function to match the interface
    function getProcessedTasksLength() external view returns (uint256) {
        uint256 count = 0;
        for(uint256 i = 1; i < nextMessageId; i++) {
            if(messages[i].processed) {
                count++;
            }
        }
        return count;
    }
}