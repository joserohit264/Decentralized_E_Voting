// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Voting
 * @dev Enhanced on-chain election contract with Manual State & Result Privacy.
 */
contract Voting {
    // ─── Data structures ────────────────────────────────────────────────────

    enum ElectionState { NotStarted, Active, Ended }

    struct Candidate {
        uint    id;
        string  name;
        uint    voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedCandidateId;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    address public admin;
    string  public electionName;
    uint8   public maxCandidates;
    ElectionState public state;

    mapping(uint => Candidate) private candidates;
    mapping(address => Voter)  private voters;

    uint   public candidatesCount;

    // ─── Events ──────────────────────────────────────────────────────────────

    event ElectionNameSet(string name);
    event MaxCandidatesSet(uint8 max);
    event CandidateAdded(uint id, string name);
    event ElectionStarted();
    event ElectionEnded();
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint indexed candidateId);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].isRegistered, "Voter not registered");
        _;
    }

    modifier onlyBeforeElectionStart() {
        require(state == ElectionState.NotStarted, "Election already started or ended");
        _;
    }

    modifier onlyDuringElection() {
        require(state == ElectionState.Active, "Election is not active");
        _;
    }

    modifier onlyAfterElectionEnd() {
        require(state == ElectionState.Ended, "Election has not ended yet");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() {
        admin = msg.sender;
        state = ElectionState.NotStarted;
    }

    // ─── Admin functions ─────────────────────────────────────────────────────

    function setElectionName(string calldata _name) 
        external 
        onlyAdmin 
        onlyBeforeElectionStart 
    {
        electionName = _name;
        emit ElectionNameSet(_name);
    }

    function setMaxCandidates(uint8 _max) 
        external 
        onlyAdmin 
        onlyBeforeElectionStart 
    {
        require(_max <= 9, "Max candidates cannot exceed 9");
        require(_max >= candidatesCount, "Cannot set max below current candidate count");
        maxCandidates = _max;
        emit MaxCandidatesSet(_max);
    }

    function addCandidate(string calldata _name) 
        external 
        onlyAdmin 
        onlyBeforeElectionStart 
    {
        require(maxCandidates > 0, "Max candidates not set");
        require(candidatesCount < maxCandidates, "Max candidates reached");
        
        uint id = candidatesCount++;
        candidates[id] = Candidate({
            id:        id,
            name:      _name,
            voteCount: 0
        });

        emit CandidateAdded(id, _name);
    }

    function startElection() external onlyAdmin {
        require(state == ElectionState.NotStarted, "Cannot start: state must be NotStarted");
        require(candidatesCount > 0, "Cannot start with zero candidates");
        state = ElectionState.Active;
        emit ElectionStarted();
    }

    function endElection() external onlyAdmin {
        require(state == ElectionState.Active, "Cannot end: state must be Active");
        state = ElectionState.Ended;
        emit ElectionEnded();
    }

    function registerVoter(address voterAddress) external onlyAdmin {
        require(voterAddress != address(0),        "Invalid address");
        require(!voters[voterAddress].isRegistered, "Already registered");

        voters[voterAddress].isRegistered = true;
        emit VoterRegistered(voterAddress);
    }

    // ─── Voter functions ──────────────────────────────────────────────────────

    function vote(uint candidateId) external onlyDuringElection onlyRegisteredVoter {
        require(!voters[msg.sender].hasVoted, "Already voted");
        require(candidateId < candidatesCount, "Invalid candidate");

        voters[msg.sender].hasVoted         = true;
        voters[msg.sender].votedCandidateId = candidateId;
        candidates[candidateId].voteCount  += 1;

        emit VoteCast(msg.sender, candidateId);
    }

    // ─── View functions ───────────────────────────────────────────────────────

    function getElectionInfo() 
        external 
        view 
        returns (
            string memory name, 
            uint8 maxCand, 
            uint candCount, 
            ElectionState currentState
        ) 
    {
        return (electionName, maxCandidates, candidatesCount, state);
    }

    /**
     * @dev Returns candidate names always.
     */
    function getCandidateNames() external view returns (string[] memory names) {
        names = new string[](candidatesCount);
        for (uint i = 0; i < candidatesCount; i++) {
            names[i] = candidates[i].name;
        }
    }

    /**
     * @dev Returns vote counts ONLY after election has ended (Privacy).
     */
    function getVoteCounts() external view returns (uint[] memory voteCounts) {
        voteCounts = new uint[](candidatesCount);
        // Only return real counts if election is Ended
        if (state == ElectionState.Ended) {
            for (uint i = 0; i < candidatesCount; i++) {
                voteCounts[i] = candidates[i].voteCount;
            }
        }
        // Otherwise returns 0s
    }

    function getVoterStatus(address voterAddress)
        external
        view
        returns (
            bool isRegistered,
            bool hasVoted,
            uint votedCandidateId
        )
    {
        Voter memory v = voters[voterAddress];
        return (v.isRegistered, v.hasVoted, v.votedCandidateId);
    }

    function getAdmin() external view returns (address) {
        return admin;
    }
}
