// ==========================================
// GAME LOGIC & MATCH MANAGER
// ==========================================

let winnerText = '';
let isGameOver = false;
let screenFlashTimer = 0;

// Backup initial table layout for room reset
let initialMapTheRoom;

// Wait for index.html to finish loading the map before copying it
window.addEventListener('load', () => {
  if (typeof mapTheRoom !== 'undefined') {
    initialMapTheRoom = JSON.parse(JSON.stringify(mapTheRoom));
  }
});

/**
 * 1. BULLET & MELEE COLLISION DETECTION
 * Checks player projectiles against opponents.
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

    // B. Check Thrown Weapon Hits (Bonus Logic: Thrown guns deal 1 damage)
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
 * 2. WIN CONDITION CHECKER
 * Ends match if any player reaches 0 health (3 hits).
 */
function checkWinCondition() {
  allPlayers.forEach((player) => {
    if (player.health <= 0) {
      const winner = allPlayers.find((p) => p !== player);
      winnerText = `PLAYER ${winner.playerNumber} YA MADE IT OUT!`;
      gameState = 'GAME_OVER';
      isGameOver = true;

      // STATKEEP HOOK: Stop round timer, package JSON payload, send to backend
      if (typeof statKeeper !== 'undefined' && statKeeper) {
        statKeeper.endRound(winner.playerNumber);
      }
    }
  });
}

/**
 * 3. COMPLETE MATCH RESET
 * Restores player positions, health, ammo, projectiles, and map tables.
 */
function resetGame() {
  // Reset Map Matrix and Destructible Tables
  if (initialMapTheRoom) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        mapTheRoom[r][c] = initialMapTheRoom[r][c];
      }
    }
  }

  // Clear table health tracking object
  for (const key in tableHealthMap) {
    delete tableHealthMap[key];
  }

  // Reset Player 1
  if (allPlayers[0]) {
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

  // Reset Player 2
  if (allPlayers[1]) {
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

  // Reset Title & Logic States
  if (typeof titleElement !== 'undefined' && titleElement) {
    titleElement.textContent = 'SHOOT';
  }

  winnerText = '';
  isGameOver = false;
  gameState = 'START_SCREEN';
}

/**
 * 4. GAME OVER & WINNER OVERLAY RENDERER
 */
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
 * 5. DAMAGE FLASH FX
 * Adds a subtle red screen flash whenever a hit lands.
 */
function renderHitFlash(ctx) {
  if (screenFlashTimer > 0) {
    ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    screenFlashTimer--;
  }
}

// Global Key Listeners for Starting Match & Restarting
window.addEventListener('keydown', (e) => {
  if (gameState === 'START_SCREEN' && (e.key === 'Enter' || e.code === 'Space' || e.key === '1' || e.key === '5')) {
    gameState = 'PLAYING';
    
    // STATKEEP HOOK: Start timing accurately right when round begins
    if (typeof statKeeper !== 'undefined' && statKeeper) {
      statKeeper.startRound();
    }
  } else if (gameState === 'GAME_OVER' && (e.key === 'Enter' || e.code === 'Space')) {
    resetGame();
  }
});