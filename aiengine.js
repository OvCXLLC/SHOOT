// ==========================================
// AIENGINE.JS - PLAYER 2 AI CONTROLLER & DDA
// ==========================================

class AIEngine {
  constructor() {
    this.matchMemory = []; 
    this.maxMemoryRounds = 6;

    this.level = 1;
    this.moveInterval = 670;
    this.shootCooldown = 1200;
    this.hasZigZag = false;
    this.canDestroyCover = false;

    this.lastMoveTime = 0;
    this.lastShootTime = 0;
    this.lastBlockTime = 0;
  }

  recordMatch(playerStats) {
    this.matchMemory.push(playerStats);
    if (this.matchMemory.length > this.maxMemoryRounds) {
      this.matchMemory.shift();
    }
  }

  getAverageVector() {
    if (this.matchMemory.length === 0) {
      return { accuracy: 0.4, blocksPlaced: 2, survivalTime: 40 };
    }
    let totalAcc = 0, totalBlocks = 0, totalSurvival = 0;
    this.matchMemory.forEach(m => {
      totalAcc += m.accuracy || 0;
      totalBlocks += m.blocksPlaced || 0;
      totalSurvival += m.survivalTime || 0;
    });
    const count = this.matchMemory.length;
    return {
      accuracy: totalAcc / count,
      blocksPlaced: totalBlocks / count,
      survivalTime: totalSurvival / count,
      roundsRecorded: count
    };
  }

  initLevel(levelNumber) {
    this.level = levelNumber;
    const avg = this.getAverageVector();

    if (this.level === 1) { // The Initiate
      this.moveInterval = 750;
      this.shootCooldown = 1600;
      this.hasZigZag = false;
    } else if (this.level === 2) { // The Enforcer
      this.moveInterval = 550;
      this.shootCooldown = 1100;
      this.hasZigZag = true;
    } else if (this.level === 3) { // The Don (Boss)
      this.moveInterval = 420;
      this.shootCooldown = 750;
      this.hasZigZag = true;
      this.canDestroyCover = true;
    }

    // Dynamic Difficulty Adjustments (DDA based on 6-round memory)
    if (avg.roundsRecorded > 0) {
      if (avg.accuracy > 0.60) this.moveInterval = Math.max(320, this.moveInterval - 100);
      if (avg.blocksPlaced >= 4) this.canDestroyCover = true;
      if (avg.accuracy < 0.25 || avg.survivalTime < 15) {
        this.shootCooldown += 500;
        this.moveInterval += 120;
      }
    }
  }

  // AI Main Decision Loop: Takes direct control of Player 2 instance
  update(aiPlayer, humanPlayer, gridMap) {
    if (!aiPlayer || !humanPlayer || aiPlayer.health <= 0) return;

    const now = Date.now();

    // 1. Auto-Reload if Empty
    if (aiPlayer.clipAmmo === 0 && aiPlayer.reserveClips > 0) {
      if (typeof aiPlayer.reload === 'function') aiPlayer.reload();
    }

    // 2. Tactical Block Placement when under direct line of sight or low health
    if (aiPlayer.health === 1 && now - this.lastBlockTime > 4000) {
      if (typeof aiPlayer.placeBlock === 'function') {
        aiPlayer.placeBlock();
        this.lastBlockTime = now;
      }
    }

    // 3. Movement Logic
    if (now - this.lastMoveTime > this.moveInterval) {
      this.lastMoveTime = now;
      this.executeMovement(aiPlayer, humanPlayer, gridMap);
    }

    // 4. Combat / Shooting / Melee Logic
    if (now - this.lastShootTime > this.shootCooldown) {
      if (this.hasLineOfSight(aiPlayer, humanPlayer)) {
        this.lastShootTime = now;
        
        if (aiPlayer.clipAmmo > 0) {
          if (typeof aiPlayer.shoot === 'function') aiPlayer.shoot();
        } else {
          // Out of ammo: Melee or throw gun
          if (typeof aiPlayer.performMeleeOrThrow === 'function') {
            aiPlayer.performMeleeOrThrow();
          }
        }
      }
    }
  }

  executeMovement(ai, human, gridMap) {
    const dRow = human.row - ai.row;
    const dCol = human.col - ai.col;

    let moveDir = 'DOWN';

    // Face toward human player before moving
    if (Math.abs(dRow) > Math.abs(dCol)) {
      moveDir = dRow > 0 ? 'DOWN' : 'UP';
    } else {
      moveDir = dCol > 0 ? 'RIGHT' : 'LEFT';
    }

    // Zig-Zag evasion tactic
    if (this.hasZigZag && Math.random() < 0.40) {
      moveDir = Math.abs(dRow) > Math.abs(dCol) ? 
        (dCol > 0 ? 'RIGHT' : 'LEFT') : (dRow > 0 ? 'DOWN' : 'UP');
    }

    // If the direct step is blocked (table / pillar / cover block), sidestep instead of freezing
    if (typeof ai.isWalkable === 'function') {
      const step = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }[moveDir];
      if (!ai.isWalkable(ai.col + step[0], ai.row + step[1], gridMap)) {
        const vertical = (moveDir === 'LEFT' || moveDir === 'RIGHT');
        const toward = vertical ? (dRow >= 0 ? 'DOWN' : 'UP') : (dCol >= 0 ? 'RIGHT' : 'LEFT');
        const away = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }[toward];
        const side = [toward, away].find((d) => {
          const s = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] }[d];
          return ai.isWalkable(ai.col + s[0], ai.row + s[1], gridMap);
        });
        if (side) moveDir = side;
      }
    }

    if (typeof ai.move === 'function') {
      ai.move(moveDir, gridMap);
    }
  }

  hasLineOfSight(ai, human) {
    return (ai.row === human.row || ai.col === human.col);
  }
}

const aiEngine = new AIEngine();