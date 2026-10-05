// ==========================================
// STATKEEP.JS - TELEMETRY & BACKEND INTEGRATION
// ==========================================

class StatKeep {
  constructor() {
    // Flask API endpoint URL
    this.flaskEndpoint = 'http://127.0.0.1:5000/api/match_stats';
    this.resetStats();
  }

  resetStats() {
    this.startTime = null;
    this.endTime = null;
    this.roundDuration = 0; // seconds

    // Individual player metric tracking
    this.playerStats = {
      1: { shotsFired: 0, shotsHit: 0, blocksPlaced: 0, blocksDestroyed: 0 },
      2: { shotsFired: 0, shotsHit: 0, blocksPlaced: 0, blocksDestroyed: 0 }
    };

    this.hasSentPayload = false;
    this.lastPayload = null;
  }

  startRound() {
    this.resetStats();
    this.startTime = Date.now();
    console.log('[StatKeep] Telemetry session started.');
  }

  logShot(playerNumber) {
    if (this.playerStats[playerNumber]) {
      this.playerStats[playerNumber].shotsFired++;
    }
  }

  logHit(shooterNumber) {
    if (this.playerStats[shooterNumber]) {
      this.playerStats[shooterNumber].shotsHit++;
    }
  }

  logBlockPlaced(playerNumber) {
    if (this.playerStats[playerNumber]) {
      this.playerStats[playerNumber].blocksPlaced++;
    }
  }

  logBlockDestroyed(playerNumber) {
    if (this.playerStats[playerNumber]) {
      this.playerStats[playerNumber].blocksDestroyed++;
    }
  }

  calculateAccuracy(playerNumber) {
    const p = this.playerStats[playerNumber];
    if (!p || p.shotsFired === 0) return 0;
    return parseFloat(((p.shotsHit / p.shotsFired) * 100).toFixed(1));
  }

  endRound(winnerNumber) {
    if (this.endTime) return; // Prevent duplicate triggers
    this.endTime = Date.now();
    this.roundDuration = parseFloat(((this.endTime - this.startTime) / 1000).toFixed(2));

    const p1 = this.playerStats[1];
    const p2 = this.playerStats[2];
    const p1AccPercent = this.calculateAccuracy(1);
    const p2AccPercent = this.calculateAccuracy(2);

    // Decimal accuracy for vector engine
    const p1AccDecimal = p1.shotsFired > 0 ? parseFloat((p1.shotsHit / p1.shotsFired).toFixed(2)) : 0.0;

    // Structured JSON Payload matching both Flask vector engine and local display requirements
    const payload = {
      matchTimestamp: new Date().toISOString(),
      winner: winnerNumber,
      roundDurationSeconds: this.roundDuration,
      
      // Top-level telemetry expected by Flask / shootdata.py:
      accuracy: p1AccDecimal,
      shotsFired: p1.shotsFired,
      blocksPlaced: p1.blocksPlaced,
      damageDealt: p1.shotsHit * 20,
      survivalTime: Math.round(this.roundDuration),
      summaryText: `Player 1 fired ${p1.shotsFired} shots with ${p1AccPercent}% accuracy (${p1.shotsHit} hits) and placed ${p1.blocksPlaced} blocks. Player 2 placed ${p2.blocksPlaced} blocks with ${p2AccPercent}% accuracy.`,

      // Detailed 2-Player breakdown for Canvas UI
      players: {
        p1: {
          ...p1,
          accuracyPercent: p1AccPercent
        },
        p2: {
          ...p2,
          accuracyPercent: p2AccPercent
        }
      }
    };

    this.lastPayload = payload;
    this.sendToBackend(payload);
  }

  async sendToBackend(payload) {
    if (this.hasSentPayload) return;
    this.hasSentPayload = true;

    try {
      const response = await fetch(this.flaskEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[StatKeep] Telemetry sent to Flask! Vector Response:', data);
      } else {
        console.warn('[StatKeep] Backend status error:', response.status);
      }
    } catch (error) {
      console.log('[StatKeep] Flask server offline. Telemetry rendered locally on end screen.');
    }
  }

  // Renders post-match telemetry panel directly on canvas
  renderStatScreen(ctx, canvasWidth, canvasHeight) {
    if (!this.lastPayload) return;

    const p1 = this.lastPayload.players.p1;
    const p2 = this.lastPayload.players.p2;

    ctx.save();

    const boxW = 480;
    const boxH = 200;
    const boxX = canvasWidth / 2 - boxW / 2;
    const boxY = canvasHeight / 2 + 90;

    // Background Card
    ctx.fillStyle = 'rgba(15, 15, 17, 0.93)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillText(`MATCH TELEMETRY & DATA SUMMARY (${this.roundDuration}s)`, canvasWidth / 2, boxY + 26);

    // Divider
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(boxX + 20, boxY + 36);
    ctx.lineTo(boxX + boxW - 20, boxY + 36);
    ctx.stroke();

    // Column Headers
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText('PLAYER 1', boxX + 110, boxY + 56);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('PLAYER 2', boxX + 370, boxY + 56);

    // Stat Rows
    const rows = [
      { label: 'Shots Fired / Hit', p1: `${p1.shotsFired} / ${p1.shotsHit}`, p2: `${p2.shotsFired} / ${p2.shotsHit}` },
      { label: 'Accuracy', p1: `${p1.accuracyPercent}%`, p2: `${p2.accuracyPercent}%` },
      { label: 'Blocks Placed', p1: `${p1.blocksPlaced}`, p2: `${p2.blocksPlaced}` },
      { label: 'Blocks Destroyed', p1: `${p1.blocksDestroyed}`, p2: `${p2.blocksDestroyed}` }
    ];

    ctx.font = '12px "Segoe UI", sans-serif';
    rows.forEach((row, idx) => {
      const y = boxY + 80 + idx * 22;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaa';
      ctx.fillText(row.label, canvasWidth / 2, y);

      ctx.fillStyle = '#fff';
      ctx.fillText(row.p1, boxX + 110, y);
      ctx.fillText(row.p2, boxX + 370, y);
    });

    // Flask Status Note
    // ctx.textAlign = 'center';
    // ctx.font = 'italic 11px "Segoe UI", sans-serif';
    // ctx.fillStyle = '#888';
    // ctx.fillText('Payload ready for Python Flask API & Matplotlib Vector Analysis', canvasWidth / 2, boxY + boxH - 12);

    ctx.restore();
  }
}

// Global Telemetry Instance
const statKeeper = new StatKeep();
window.statKeeper = statKeeper; // Attach explicitly to window context