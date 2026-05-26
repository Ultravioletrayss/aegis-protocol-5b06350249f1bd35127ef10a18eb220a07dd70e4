// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentRegistry
 * @dev Minimal on-chain registry for AI agents in the Aegis Protocol.
 *      Each agent gets a unique ID — referenced in intents to attribute execution.
 *      MVP scope: no access control beyond owner mapping.
 */
contract AgentRegistry {
    uint256 public agentCount;

    struct Agent {
        address owner;
        string  name;
        uint256 createdAt;
    }

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public agentsByOwner;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name);

    /**
     * @dev Register a new AI agent. Returns the agent's unique ID.
     */
    function register(string calldata name) external returns (uint256) {
        uint256 agentId = ++agentCount;
        agents[agentId] = Agent({
            owner: msg.sender,
            name: name,
            createdAt: block.timestamp
        });
        agentsByOwner[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, name);
        return agentId;
    }

    /**
     * @dev Get all agent IDs owned by an address.
     */
    function getAgentIdsByOwner(address owner) external view returns (uint256[] memory) {
        return agentsByOwner[owner];
    }
}
