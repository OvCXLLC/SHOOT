// ==========================================
// GAME LOGIC & MATCH MANAGER
// ==========================================

let winnerText = '';
let isGameOver = false;
let screenFlashTimer = 0;

// Game Mode & Pause Tracking
let gameMode = 'PVP'; // 'PVP' or 'VS_AI'
let selectedAILevel = 1;

// Backup initial table layout for room reset
let initialMapTheRoom;

// Wait for index.html to finish loading the map before copying it
window.addEventListener('load', () => {
  if (typeof mapTheRoom !== 'undefined') {
    initialMapTheRoom = JSON.parse(JSON.stringify(mapTheRoom));
  }
});

/**
 * 1. BULLET, THROWN WEAPON & MELEE COLLISION DETECTION
 * Checks player projectiles and swings against opponents.
 */
function checkCollisions() {
  if (gameState !== 'PLAYING') return;

  allPlayers.forEach((shooter) => {
    // A. Check Bullet Hits on Opponents
    for (let i = shooter.bullets.length - 1; i >= 0; i--) {
      const bullet = shooter.bullets[i];
      const bulletCol = Math.floor(bullet.x / TILE_SIZE);
      const bulletRow = Math.floor(bullet.y / TILE_SIZE);

      allPlayers.forEach((target) => {
        // Only check against other players
        if (target !== shooter) {
          if (target.col === bulletCol && target.row === bulletRow) {
            // Bullet Hit!
            target.takeDamage(1);
            shooter.bullets.splice(i, 1);
            screenFlashTimer = 6; // Brief red screen flash effect

            // STATKEEP HOOK: Log successful shot landing
            if (typeof statKeeper !== 'undefined' && statKeeper) {
              statKeeper.logHit(shooter.playerNumber);
            }

            checkWinCondition();
          }
        }
      });
    }

    // B. Check Thrown Weapon Hits (Thrown guns deal 1 damage)
    for (let i = shooter.thrownWeapons.length - 1; i >= 0; i--) {
      const weapon = shooter.thrownWeapons[i];
      const weaponCol = Math.floor(weapon.x / TILE_SIZE);
      const weaponRow = Math.floor(weapon.y / TILE_SIZE);

      allPlayers.forEach((target) => {
        if (target !== shooter) {
          if (target.col === weaponCol && target.row === weaponRow) {
            target.takeDamage(1);
            shooter.thrownWeapons.splice(i, 1);
            screenFlashTimer = 6;

            // STATKEEP HOOK: Log hit
            if (typeof statKeeper !== 'undefined' && statKeeper) {
              statKeeper.logHit(shooter.playerNumber);
            }

            checkWinCondition();
          }
        }
      });
    }

    // C. Check Melee Hits on Opponents
    if (shooter.meleeSwing && shooter.meleeSwing.timer === 9) {
      allPlayers.forEach((target) => {
        if (target !== shooter) {
          if (target.col === shooter.meleeSwing.col && target.row === shooter.meleeSwing.row) {
            target.takeDamage(1);
            screenFlashTimer = 6;

            // STATKEEP HOOK: Log hit
            if (typeof statKeeper !== 'undefined' && statKeeper) {
              statKeeper.logHit(shooter.playerNumber);
            }

            checkWinCondition();
          }
        }
      });
    }
  });
}

/**
 * 2. AI UPDATER HOOK (Step 3 Update)
 * Passes Player 2 (allPlayers[1]) directly into aiEngine.update.
 */
function updateAILogic() {
  if (gameState === 'PLAYING' && gameMode === 'VS_AI' && typeof aiEngine !== 'undefined') {
    // Player 1 (index 0) is Human, Player 2 (index 1) is AI
    const humanPlayer = allPlayers[0];
    const aiPlayer = allPlayers[1];

    if (aiPlayer && humanPlayer && typeof mapTheRoom !== 'undefined') {
      aiEngine.update(aiPlayer, humanPlayer, mapTheRoom);
    }
  }
}

/**
 * 3. WIN CONDITION CHECKER
 * Ends match if any player reaches 0 health (3 hits).
 */
function checkWinCondition() {
  if (gameState === 'GAME_OVER') return; // round already decided this frame
  allPlayers.forEach((player) => {
    if (gameState === 'GAME_OVER') return;
    if (player.health <= 0) {
      const winner = allPlayers.find((p) => p !== player);
      winnerText = `PLAYER ${winner.playerNumber} YA MADE IT OUT!`;
      gameState = 'GAME_OVER';
      isGameOver = true;

      // STATKEEP HOOK: Stop round timer, package JSON payload, send to backend
      if (typeof statKeeper !== 'undefined' && statKeeper) {
        statKeeper.endRound(winner.playerNumber);
      }

      // AI MEMORY HOOK: Feed round stats into AI rolling 6-round memory
      if (gameMode === 'VS_AI' && typeof aiEngine !== 'undefined' && typeof statKeeper !== 'undefined') {
        const stats = statKeeper.getSummaryStats ? statKeeper.getSummaryStats(1) : {};
        aiEngine.recordMatch(stats);
      }
    }
  });
}

/**
 * 4. COMPLETE MATCH RESET
 * Restores player positions, health, ammo, projectiles, and map layout.
 */
function resetGame() {
  // Reset Map Matrix and Destructible Tables
  if (initialMapTheRoom && typeof mapTheRoom !== 'undefined') {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        mapTheRoom[r][c] = initialMapTheRoom[r][c];
      }
    }
  }

  // Clear table health tracking object
  if (typeof tableHealthMap !== 'undefined') {
    for (const key in tableHealthMap) {
      delete tableHealthMap[key];
    }
  }

  // Reset Player 1
  if (allPlayers && allPlayers[0]) {
    allPlayers[0].col = 1;
    allPlayers[0].row = 1;
    allPlayers[0].facing = 'DOWN';
    allPlayers[0].health = 3;
    allPlayers[0].clipAmmo = 6;
    allPlayers[0].reserveClips = 3;
    allPlayers[0].isWeaponThrown = false;
    allPlayers[0].bullets = [];
    allPlayers[0].thrownWeapons = [];
    allPlayers[0].placedBlocks = [];
    allPlayers[0].meleeSwing = null;
  }

  // Reset Player 2 / AI
  if (allPlayers && allPlayers[1]) {
    allPlayers[1].col = 30;
    allPlayers[1].row = 1;
    allPlayers[1].facing = 'DOWN';
    allPlayers[1].health = 3;
    allPlayers[1].clipAmmo = 6;
    allPlayers[1].reserveClips = 3;
    allPlayers[1].isWeaponThrown = false;
    allPlayers[1].bullets = [];
    allPlayers[1].thrownWeapons = [];
    allPlayers[1].placedBlocks = [];
    allPlayers[1].meleeSwing = null;
  }

  // Clear held-key movement state
  allPlayers.forEach((p) => {
    p.activeMoveKey = null;
    Object.values(p.keyHeldTimers || {}).forEach(clearInterval);
    p.keyHeldTimers = {};
  });

  // Reset Title & Logic States
  if (typeof titleElement !== 'undefined' && titleElement) {
    titleElement.textContent = 'SHOOT';
  }

  winnerText = '';
  isGameOver = false;
  gameState = 'START_SCREEN';

  if (typeof startScreen !== 'undefined' && startScreen) {
    startScreen.menuState = 'MAIN';
  }
}

/**
 * 5. MATCH START HELPER
 */
function startMatch() {
  gameState = 'PLAYING';
  if (typeof titleElement !== 'undefined' && titleElement) {
    titleElement.textContent = gameMode === 'VS_AI' ? `VS AI - Level ${selectedAILevel}` : 'Local 2-Player Match';
  }
  if (typeof statKeeper !== 'undefined' && statKeeper) {
    statKeeper.startRound();
  }
}

/**
 * 6. OVERLAY RENDERERS (PAUSED & GAME OVER)
 */
function renderPauseOverlay(ctx) {
  if (gameState !== 'PAUSED') return;

  const w = canvas.width;
  const h = canvas.height;

  // Semi-Transparent Backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, w, h);

  // Pause Card
  ctx.fillStyle = '#151518';
  ctx.fillRect(w / 2 - 160, h / 2 - 90, 320, 180);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(w / 2 - 160, h / 2 - 90, 320, 180);

  // Text Elements
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6e6e6';
  ctx.font = '900 32px "Impact", sans-serif';
  ctx.fillText('GAME PAUSED', w / 2, h / 2 - 30);

  ctx.fillStyle = '#2ecc71';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText('PRESS [ P ] TO RESUME', w / 2, h / 2 + 20);

  ctx.fillStyle = '#888888';
  ctx.font = 'italic 13px "Segoe UI", sans-serif';
  const aiLvlText = (typeof aiEngine !== 'undefined' && aiEngine.level) ? aiEngine.level : selectedAILevel;
  ctx.fillText(`MODE: ${gameMode === 'VS_AI' ? 'VS AI (LEVEL ' + aiLvlText + ')' : 'LOCAL PVP'}`, w / 2, h / 2 + 55);
}

function renderGameOverOverlay(ctx) {
  if (gameState !== 'GAME_OVER') return;

  // Dark Semi-Transparent Backdrop
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Victory Banner Container
  ctx.fillStyle = '#111215';
  ctx.fillRect(canvas.width / 2 - 260, canvas.height / 2 - 80, 520, 160);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.strokeRect(canvas.width / 2 - 260, canvas.height / 2 - 80, 520, 160);

  // Winner Announcement Text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = '900 24px "Impact", "Segoe UI", sans-serif';
  ctx.fillText(winnerText, canvas.width / 2, canvas.height / 2 - 20);

  // Replay Prompt
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.fillText('PRESS [ENTER] OR [SPACE] TO RETURN TO MENU', canvas.width / 2, canvas.height / 2 + 30);

  // STATKEEP HOOK: Render the end-of-game stat dashboard overlay
  if (typeof statKeeper !== 'undefined' && statKeeper) {
    statKeeper.renderStatScreen(ctx, canvas.width, canvas.height);
  }
}

/**
 * 7. DAMAGE FLASH FX
 */
function renderHitFlash(ctx) {
  if (screenFlashTimer > 0) {
    ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    screenFlashTimer--;
  }
}

/**
 * 8. GLOBAL INPUT LISTENERS & KEY ROUTING
 */
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  // A. Pause Toggle (P Key)
  if (key === 'p') {
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      return;
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      return;
    }
  }

  // B. Start Screen Router Handling
  if (gameState === 'START_SCREEN') {
    if (typeof startScreen !== 'undefined' && startScreen.handleKeyDown) {
      const result = startScreen.handleKeyDown(e);
      if (result && result.action === 'START_GAME') {
        gameMode = result.mode;
        if (gameMode === 'VS_AI') {
          selectedAILevel = result.level || 1;
          if (typeof aiEngine !== 'undefined') {
            aiEngine.initLevel(selectedAILevel);
          }
        }
        startMatch();
      }
      return;
    }

    // Direct key shortcuts if startScreen manager class is not present
    if (key === '1') {
      gameMode = 'PVP';
      startMatch();
    } else if (key === '5') {
      gameMode = 'VS_AI';
      selectedAILevel = 1;
      if (typeof aiEngine !== 'undefined') {
        aiEngine.initLevel(selectedAILevel);
      }
      startMatch();
    } else if (key === 'enter' || e.code === 'Space') {
      gameMode = 'PVP';
      startMatch();
    }
  } 
  // C. Game Over Reset
  else if (gameState === 'GAME_OVER' && (key === 'enter' || e.code === 'Space')) {
    resetGame();
  }
});
