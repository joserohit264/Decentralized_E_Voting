import React, { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { HARDHAT_ACCOUNTS, LOCAL_NODE_URL } from "./constants";
import config from "./contract-config.json";
import "./App.css";

const ELECTION_STATES = {
  0: "NotStarted",
  1: "Active",
  2: "Ended"
};

function App() {
  const [activeAccount, setActiveAccount] = useState(HARDHAT_ACCOUNTS[0]);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [wallet, setWallet] = useState(null);

  // Election State from Contract
  const [electionInfo, setElectionInfo] = useState({ name: "", maxCand: 0, candCount: 0, state: 0 });
  const [candidateNames, setCandidateNames] = useState([]);
  const [voteCounts, setVoteCounts] = useState([]);
  const [voterStatus, setVoterStatus] = useState(null);
  const [adminAddress, setAdminAddress] = useState("");

  // Form State
  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState(0);
  const [candidateToAdd, setCandidateToAdd] = useState("");

  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  // 1. Initialize Provider
  useEffect(() => {
    const _provider = new ethers.providers.JsonRpcProvider(LOCAL_NODE_URL);
    setProvider(_provider);
  }, []);

  // 2. Sync Wallet & Contract on Account Switch
  useEffect(() => {
    if (!provider) return;
    const _wallet = new ethers.Wallet(activeAccount.privateKey, provider);
    const _contract = new ethers.Contract(config.address, config.abi, _wallet);
    setWallet(_wallet);
    setContract(_contract);

    refreshData(_contract, _wallet.address);
  }, [activeAccount, provider]);

  const refreshData = async (c, addr) => {
    try {
      const info = await c.getElectionInfo();
      setElectionInfo({
        name: info.name,
        maxCand: info.maxCand,
        candCount: info.candCount.toNumber(),
        state: info.currentState,
      });

      const names = await c.getCandidateNames();
      setCandidateNames(names);

      const counts = await c.getVoteCounts();
      setVoteCounts(counts.map(tc => tc.toNumber()));

      const status = await c.getVoterStatus(addr);
      setVoterStatus({
        isRegistered: status.isRegistered,
        hasVoted: status.hasVoted,
        votedCandidateId: status.votedCandidateId.toNumber()
      });

      const _admin = await c.getAdmin();
      setAdminAddress(_admin);
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  // Poll for updates
  useEffect(() => {
    if (!contract || !wallet) return;
    const interval = setInterval(() => refreshData(contract, wallet.address), 3000);
    return () => clearInterval(interval);
  }, [contract, wallet]);

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  // --- Contract Actions ---

  const handleSetElectionName = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tx = await contract.setElectionName(newName);
      await tx.wait();
      showMessage("Election name updated!", "success");
      setNewName("");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to set name", "error");
    }
    setLoading(false);
  };

  const handleSetMaxCandidates = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tx = await contract.setMaxCandidates(newMax);
      await tx.wait();
      showMessage(`Max candidates set to ${newMax}`, "success");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to set max", "error");
    }
    setLoading(false);
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tx = await contract.addCandidate(candidateToAdd);
      await tx.wait();
      showMessage(`${candidateToAdd} added!`, "success");
      setCandidateToAdd("");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to add candidate", "error");
    }
    setLoading(false);
  };

  const handleStartElection = async () => {
    setLoading(true);
    try {
      const tx = await contract.startElection();
      await tx.wait();
      showMessage("Election Started!", "success");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to start", "error");
    }
    setLoading(false);
  };

  const handleEndElection = async () => {
    setLoading(true);
    try {
      const tx = await contract.endElection();
      await tx.wait();
      showMessage("Election Ended!", "success");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to end", "error");
    }
    setLoading(false);
  };

  const handleVote = async (id) => {
    setLoading(true);
    try {
      const tx = await contract.vote(id);
      await tx.wait();
      showMessage("Vote cast successfully!", "success");
      refreshData(contract, wallet.address);
    } catch (err) {
      showMessage(err.reason || "Failed to vote", "error");
    }
    setLoading(false);
  };

  // --- UI Helpers ---

  const isAdmin = wallet?.address.toLowerCase() === adminAddress.toLowerCase();
  const stateStr = ELECTION_STATES[electionInfo.state];

  const resultsAvailable = electionInfo.state === 2; // Ended

  const winners = useMemo(() => {
    if (!resultsAvailable || voteCounts.length === 0) return [];
    const maxVotes = Math.max(...voteCounts);
    return candidateNames
      .map((name, i) => ({ name, voteCount: voteCounts[i] }))
      .filter(c => c.voteCount === maxVotes);
  }, [resultsAvailable, voteCounts, candidateNames]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>VoteChain Pro 🗳️</h1>
        <p className="subtitle">{electionInfo.name || "Awaiting Setup"}</p>
        <div className={`status-badge ${stateStr}`}>
          {stateStr.replace(/([A-Z])/g, ' $1').trim()}
        </div>
      </header>

      <div className="top-bar">
        <div className="account-selector">
          <label>Identity:</label>
          <select value={activeAccount.address} onChange={(e) => setActiveAccount(HARDHAT_ACCOUNTS.find(a => a.address === e.target.value))}>
            {HARDHAT_ACCOUNTS.map(a => <option key={a.address} value={a.address}>{a.label}</option>)}
          </select>
        </div>
        <div className="account-info">
          <span className="address-label">{wallet?.address}</span>
          {isAdmin && <span className="admin-tag">ADMIN</span>}
        </div>
      </div>

      {message.text && <div className={`toast ${message.type}`}>{message.text}</div>}

      <main className="dashboard">
        <div className="controls-column">

          {/* Admin: Setup */}
          {isAdmin && (
            <section className="card admin-card">
              <h2>⚙️ Election Setup</h2>
              {electionInfo.state === 0 ? (
                <div className="setup-grid">
                  <form onSubmit={handleSetElectionName} className="pro-form inline">
                    <input type="text" placeholder="Election Name" value={newName} onChange={e => setNewName(e.target.value)} />
                    <button type="submit" disabled={loading}>Set Name</button>
                  </form>
                  <form onSubmit={handleSetMaxCandidates} className="pro-form inline">
                    <input type="number" min="0" max="9" placeholder="Max Candidates (0-9)" value={newMax} onChange={e => setNewMax(e.target.value)} />
                    <button type="submit" disabled={loading}>Set Max</button>
                  </form>
                </div>
              ) : (
                <p className="info-text">Configuration locked after start.</p>
              )}

              <hr />

              <h2>👥 Candidates ({electionInfo.candCount}/{electionInfo.maxCand})</h2>
              {electionInfo.state === 0 && electionInfo.candCount < electionInfo.maxCand ? (
                <form onSubmit={handleAddCandidate} className="pro-form inline">
                  <input type="text" placeholder="Candidate Name" value={candidateToAdd} onChange={e => setCandidateToAdd(e.target.value)} disabled={loading} />
                  <button type="submit" disabled={loading}>Add</button>
                </form>
              ) : (
                <ul className="candidate-list">
                  {candidateNames.map((name, i) => <li key={i}>{name}</li>)}
                </ul>
              )}

              <hr />

              <h2>🚀 Lifecycle Control</h2>
              <div className="btn-group">
                {electionInfo.state === 0 && (
                  <button className="start-btn" onClick={handleStartElection} disabled={loading || electionInfo.candCount === 0}>Start Election</button>
                )}
                {electionInfo.state === 1 && (
                  <button className="end-btn" onClick={handleEndElection} disabled={loading}>End Election</button>
                )}
                {electionInfo.state === 2 && <span>Election Concluded</span>}
              </div>
            </section>
          )}

          {/* Voter: Portal */}
          <section className="card main-card">
            <h2>🗳️ Voter Portal</h2>

            {!voterStatus?.isRegistered ? (
              <div className="alert-box warning">Not Registered to Vote</div>
            ) : electionInfo.state === 0 ? (
              <div className="alert-box info">Election has not started yet.</div>
            ) : electionInfo.state === 2 ? (
              <div className="alert-box success">Voting has concluded.</div>
            ) : voterStatus.hasVoted ? (
              <div className="alert-box success">Vote cast for Candidate: {candidateNames[voterStatus.votedCandidateId]}</div>
            ) : (
              <div className="candidate-grid">
                {candidateNames.map((name, id) => (
                  <button key={id} className="vote-btn" onClick={() => handleVote(id)} disabled={loading}>
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="results-column">
          <section className="card results-card">
            <h2>📊 Final Results</h2>

            {!resultsAvailable ? (
              <div className="privacy-placeholder">
                <div className="lock-icon">🔒</div>
                <p>Results are hidden while voting is in progress.</p>
                <small>Check back after the admin concludes the election.</small>
              </div>
            ) : (
              <>
                {winners.length > 1 && (
                  <div className="tie-banner">
                    ⚠️ <strong>Tie Detected!</strong><br />
                    {winners.map(w => w.name).join(" & ")} tied with {winners[0].voteCount} votes.
                  </div>
                )}
                {winners.length === 1 && (
                  <div className="winner-banner">
                    🏆 <strong>Winner: {winners[0].name}</strong><br />
                    with {winners[0].voteCount} votes.
                  </div>
                )}

                <div className="chart">
                  {candidateNames.map((name, i) => {
                    const count = voteCounts[i];
                    const maxVal = Math.max(...voteCounts, 1);
                    const width = (count / maxVal) * 100;
                    const isWinner = winners.some(w => w.name === name);
                    return (
                      <div key={i} className={`chart-row ${isWinner ? 'leading' : ''}`}>
                        <div className="row-info">
                          <span>{name}</span>
                          <strong>{count}</strong>
                        </div>
                        <div className="bar-bg">
                          <div className="bar-fill" style={{ width: `${width}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
