import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("Voting Contract (Manual State & Privacy)", function () {
    let voting;
    let admin, voter1, voter2, nonVoter;

    beforeEach(async function () {
        [admin, voter1, voter2, nonVoter] = await ethers.getSigners();
        const Voting = await ethers.getContractFactory("Voting");
        voting = await Voting.deploy();
        await voting.waitForDeployment();
    });

    describe("Election Configuration", function () {
        it("Admin can set election name and max candidates", async function () {
            await voting.setElectionName("Manual Election");
            await voting.setMaxCandidates(5);

            const info = await voting.getElectionInfo();
            expect(info.name).to.equal("Manual Election");
            expect(info.maxCand).to.equal(5);
        });

        it("Reverts if max candidates exceeds 9", async function () {
            await expect(voting.setMaxCandidates(10)).to.be.revertedWith("Max candidates cannot exceed 9");
        });

        it("Reverts if adding candidate before setting max", async function () {
            await expect(voting.addCandidate("Alice")).to.be.revertedWith("Max candidates not set");
        });

        it("Enforces max candidates limit", async function () {
            await voting.setMaxCandidates(2);
            await voting.addCandidate("Alice");
            await voting.addCandidate("Bob");
            await expect(voting.addCandidate("Charlie")).to.be.revertedWith("Max candidates reached");
        });
    });

    describe("State Transitions", function () {
        it("Admin can start and end election", async function () {
            await voting.setMaxCandidates(1);
            await voting.addCandidate("Alice");

            await voting.startElection();
            let info = await voting.getElectionInfo();
            expect(info.currentState).to.equal(1); // Active

            await voting.endElection();
            info = await voting.getElectionInfo();
            expect(info.currentState).to.equal(2); // Ended
        });

        it("Reverts if starting without candidates", async function () {
            await voting.setMaxCandidates(1);
            await expect(voting.startElection()).to.be.revertedWith("Cannot start with zero candidates");
        });

        it("Reverts if ending without starting", async function () {
            await expect(voting.endElection()).to.be.revertedWith("Cannot end: state must be Active");
        });
    });

    describe("Result Privacy", function () {
        beforeEach(async function () {
            await voting.setMaxCandidates(2);
            await voting.addCandidate("Alice");
            await voting.addCandidate("Bob");
            await voting.registerVoter(voter1.address);
        });

        it("Hides vote counts during Active state", async function () {
            await voting.startElection();
            await voting.connect(voter1).vote(0);

            const counts = await voting.getVoteCounts();
            expect(counts[0]).to.equal(0n);
            expect(counts[1]).to.equal(0n);
        });

        it("Shows vote counts after Ended state", async function () {
            await voting.startElection();
            await voting.connect(voter1).vote(0);
            await voting.endElection();

            const counts = await voting.getVoteCounts();
            expect(counts[0]).to.equal(1n);
        });
    });

    describe("Voting Logic", function () {
        it("Reverts if voting when NotStarted", async function () {
            await voting.setMaxCandidates(1);
            await voting.addCandidate("Alice");
            await voting.registerVoter(voter1.address);
            await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("Election is not active");
        });

        it("Reverts if voting when Ended", async function () {
            await voting.setMaxCandidates(1);
            await voting.addCandidate("Alice");
            await voting.registerVoter(voter1.address);
            await voting.startElection();
            await voting.endElection();
            await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("Election is not active");
        });
    });
});
