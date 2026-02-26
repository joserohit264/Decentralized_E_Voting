import hre from "hardhat";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HARDHAT_ACCOUNTS = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
];

async function main() {
    console.log("Deploying VoteChain Pro (Auto-Registration) contract...\n");

    const Voting = await hre.ethers.getContractFactory("Voting");
    const voting = await Voting.deploy();
    await voting.waitForDeployment();

    const contractAddress = await voting.getAddress();
    console.log(`✅  VoteChain Pro deployed to: ${contractAddress}`);

    console.log("\n📋  Auto-registering 10 simulator accounts...");
    for (const addr of HARDHAT_ACCOUNTS) {
        try {
            const tx = await voting.registerVoter(addr);
            await tx.wait();
            console.log(`    - Registered: ${addr}`);
        } catch (err) {
            console.log(`    - Skip (already registered): ${addr}`);
        }
    }

    // ── Write config for the frontend ─────────────────────────────────────────
    const artifact = await hre.artifacts.readArtifact("Voting");
    const configDir = path.join(__dirname, "..", "frontend", "src");
    const configPath = path.join(configDir, "contract-config.json");

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        configPath,
        JSON.stringify({ address: contractAddress, abi: artifact.abi }, null, 2)
    );

    console.log(`\n📄  Contract config written to: ${configPath}`);
    console.log("\n─────────────────────────────────────────────────────────────");
    console.log("Next steps: All 10 accounts are pre-registered.");
    console.log("  1. Admin Setup (Account 0)");
    console.log("  2. Start Election");
    console.log("  3. Vote!");
    console.log("─────────────────────────────────────────────────────────────\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
