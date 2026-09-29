// --- PLAYER CLASS & LOGIC ---

class Player {
  constructor(startCol, startRow) {
    // Grid Coordinates & Facing Direction
    this.col = startCol;
    this.row = startRow;
    this.facing = 'DOWN'; // 'UP', 'DOWN', 'LEFT', 'RIGHT'

    // Health (3 bars)
    this.health = 3;
    this.maxHealth = 3;

    // Weapon & Ammo System
    this.clipAmmo = 6;          // Bullets currently loaded
    this.maxClipAmmo = 6;
    this.reserveClips = 3;      // Remaining full reloads
    this.isWeaponThrown = false; // True when gun has been thrown

    // Projectile Range & Speeds
    this.bulletMaxDistance = 6 * TILE_SIZE;  // 6 tiles max range
    this.bulletSpeed = 12;                   // Medium-fast bullet speed
    this.throwMaxDistance = 3 * TILE_SIZE;   // 3 tiles max range
    this.throwSpeed = 5;                     // Slower speed for thrown weapon

    // Active Objects
    this.bullets = [];
    this.thrownWeapons = [];
    this.meleeSwing = null; // Temporary melee hit visual

    // Movement Repeat Timers (0.67s delay when held)
    this.moveDelay = 670; // 0.67 seconds in milliseconds
    this.keyPressTimes = {};
    this.keyHeldTimers = {};

    // Input States
    this.activeMoveKey = null;

    this.setupControls();
  }

  // --- INPUT EVENT LISTENERS ---
  setupControls() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      // Handle WASD Movement
      if (['w', 'a', 's', 'd'].includes(key)) {
        if (this.activeMoveKey !== key) {
          this.activeMoveKey = key;
          this.handleStep(key); // Step 1 tile immediately on initial press

          // Clear previous timer and set repeat interval (0.67s)
          clearInterval(this.keyHeldTimers[key]);
          this.keyHeldTimers[key] = setInterval(() => {
            if (this.activeMoveKey === key) {
              this.handleStep(key);
            }
          }, this.moveDelay);
        }
      }

      // Action: Spacebar -> Shoot Bullet
      if (e.code === 'Space') {
        e.preventDefault();
        this.shoot();
      }

      // Action: Left Shift -> Place Block
      if (e.key === 'Shift') {
        e.preventDefault();
        this.placeBlock();
      }

      // Action: E Key -> Melee Attack or Weapon Throw
      if (key === 'e') {
        this.handleEAction();
      }

      // Action: R Key -> Reload Manual
      if (key === 'r') {
        this.reload();
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        clearInterval(this.keyHeldTimers[key]);
        if (this.activeMoveKey === key) {
          this.activeMoveKey = null;
        }
      }
    });
  }

  // --- TILE MOVEMENT & COLLISION ---
  handleStep(key) {
    let targetCol = this.col;
    let targetRow = this.row;

    if (key === 'w') {
      this.facing = 'UP';
      targetRow--;
    } else if (key === 's') {
      this.facing = 'DOWN';
      targetRow++;
    } else if (key === 'a') {
      this.facing = 'LEFT';
      targetCol--;
    } else if (key === 'd') {
      this.facing = 'RIGHT';
      targetCol++;
    }

    // Check map collision before stepping
    if (this.isWalkable(targetCol, targetRow)) {
      this.col = targetCol;
      this.row = targetRow;
    }
  }

  isWalkable(col, row) {
    // Bounds check
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    // Map tile check (0 = Walkable Floor)
    return mapTheRoom[row][col] === 0;
  }

  // --- GET TARGET TILE IN FACING DIRECTION ---
  getFrontTile() {
    let frontCol = this.col;
    let frontRow = this.row;

    if (this.facing === 'UP') frontRow--;
    if (this.facing === 'DOWN') frontRow++;
    if (this.facing === 'LEFT') frontCol--;
    if (this.facing === 'RIGHT') frontCol++;

    return { col: frontCol, row: frontRow };
  }

  // --- BLOCK PLACEMENT (LEFT SHIFT) ---
  placeBlock() {
    const front = this.getFrontTile();

    // Can only place block on empty walkable floor (0)
    if (
      front.col >= 0 && front.col < COLS &&
      front.row >= 0 && front.row < ROWS &&
      mapTheRoom[front.row][front.col] === 0
    ) {
      // Place concrete/wooden barricade block (Tile 3)
      mapTheRoom[front.row][front.col] = 3;
    }
  }

  // --- SHOOTING (SPACEBAR) ---
  shoot() {
    if (this.isWeaponThrown) return; // Cannot shoot if gun was thrown

    if (this.clipAmmo > 0) {
      this.clipAmmo--;

      const startX = this.col * TILE_SIZE + TILE_SIZE / 2;
      const startY = this.row * TILE_SIZE + TILE_SIZE / 2;

      this.bullets.push({
        x: startX,
        y: startY,
        startX: startX,
        startY: startY,
        facing: this.facing,
        distanceTraveled: 0
      });
    }
  }

  // --- RELOAD (R KEY) ---
  reload() {
    if (this.reserveClips > 0 && this.clipAmmo < this.maxClipAmmo) {
      this.reserveClips--;
      this.clipAmmo = this.maxClipAmmo;
    }
  }

  // --- CONTEXTUAL E ACTION (MELEE OR WEAPON THROW) ---
  handleEAction() {
    if (this.isWeaponThrown) return;

    // Case 1: Completely out of ammo (clip = 0 AND clips = 0) -> Throw Weapon
    if (this.clipAmmo === 0 && this.reserveClips === 0) {
      this.throwWeapon();
    }
    // Case 2: Clip is empty (0 ammo in current magazine) -> Melee Attack
    else if (this.clipAmmo === 0) {
      this.performMelee();
    }
  }

  performMelee() {
    const front = this.getFrontTile();
    this.meleeSwing = {
      col: front.col,
      row: front.row,
      timer: 10 // Frames to render slash
    };
  }

  throwWeapon() {
    this.isWeaponThrown = true;
    const startX = this.col * TILE_SIZE + TILE_SIZE / 2;
    const startY = this.row * TILE_SIZE + TILE_SIZE / 2;

    this.thrownWeapons.push({
      x: startX,
      y: startY,
      startX: startX,
      startY: startY,
      facing: this.facing,
      distanceTraveled: 0
    });
  }

  // --- UPDATE BULLETS & PROJECTILES ---
  update() {
    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.facing === 'UP') b.y -= this.bulletSpeed;
      if (b.facing === 'DOWN') b.y += this.bulletSpeed;
      if (b.facing === 'LEFT') b.x -= this.bulletSpeed;
      if (b.facing === 'RIGHT') b.x += this.bulletSpeed;

      const currentDist = Math.hypot(b.x - b.startX, b.y - b.startY);

      // Grid collision check
      const gridCol = Math.floor(b.x / TILE_SIZE);
      const gridRow = Math.floor(b.y / TILE_SIZE);

      const hitWall =
        gridCol < 0 || gridCol >= COLS ||
        gridRow < 0 || gridRow >= ROWS ||
        mapTheRoom[gridRow][gridCol] !== 0;

      // Remove bullet if range reached (6 tiles) or hit wall
      if (currentDist >= this.bulletMaxDistance || hitWall) {
        this.bullets.splice(i, 1);
      }
    }

    // Update Thrown Weapons
    for (let i = this.thrownWeapons.length - 1; i >= 0; i--) {
      const w = this.thrownWeapons[i];

      if (w.facing === 'UP') w.y -= this.throwSpeed;
      if (w.facing === 'DOWN') w.y += this.throwSpeed;
      if (w.facing === 'LEFT') w.x -= this.throwSpeed;
      if (w.facing === 'RIGHT') w.x += this.throwSpeed;

      const currentDist = Math.hypot(w.x - w.startX, w.y - w.startY);

      const gridCol = Math.floor(w.x / TILE_SIZE);
      const gridRow = Math.floor(w.y / TILE_SIZE);

      const hitWall =
        gridCol < 0 || gridCol >= COLS ||
        gridRow < 0 || gridRow >= ROWS ||
        mapTheRoom[gridRow][gridCol] !== 0;

      // Remove thrown weapon if range reached (3 tiles) or hit wall
      if (currentDist >= this.throwMaxDistance || hitWall) {
        this.thrownWeapons.splice(i, 1);
      }
    }

    // Decrement melee animation timer
    if (this.meleeSwing) {
      this.meleeSwing.timer--;
      if (this.meleeSwing.timer <= 0) {
        this.meleeSwing = null;
      }
    }
  }

  // --- RENDER PLAYER, HUD & PROJECTILES ---
  render(ctx) {
    const px = this.col * TILE_SIZE;
    const py = this.row * TILE_SIZE;

    // 1. Draw Player Block (Placeholder Mafia Navy Blue Body)
    ctx.fillStyle = '#1c3144';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Block Border
    ctx.strokeStyle = '#d4af37'; // Gold Accent
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // 2. Draw Directional Arrow (Facing Indicator)
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();

    const centerX = px + TILE_SIZE / 2;
    const centerY = py + TILE_SIZE / 2;

    if (this.facing === 'UP') {
      ctx.moveTo(centerX, py + 4);
      ctx.lineTo(centerX - 6, py + 14);
      ctx.lineTo(centerX + 6, py + 14);
    } else if (this.facing === 'DOWN') {
      ctx.moveTo(centerX, py + TILE_SIZE - 4);
      ctx.lineTo(centerX - 6, py + TILE_SIZE - 14);
      ctx.lineTo(centerX + 6, py + TILE_SIZE - 14);
    } else if (this.facing === 'LEFT') {
      ctx.moveTo(px + 4, centerY);
      ctx.lineTo(px + 14, centerY - 6);
      ctx.lineTo(px + 14, centerY + 6);
    } else if (this.facing === 'RIGHT') {
      ctx.moveTo(px + TILE_SIZE - 4, centerY);
      ctx.lineTo(px + TILE_SIZE - 14, centerY - 6);
      ctx.lineTo(px + TILE_SIZE - 14, centerY + 6);
    }
    ctx.closePath();
    ctx.fill();

    // 3. Draw Bullets
    ctx.fillStyle = '#ffcc00';
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Thrown Weapon
    ctx.fillStyle = '#aaaaaa';
    for (const w of this.thrownWeapons) {
      ctx.fillRect(w.x - 6, w.y - 6, 12, 12);
    }

    // 5. Draw Melee Visual Slash
    if (this.meleeSwing) {
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 4;
      ctx.strokeRect(
        this.meleeSwing.col * TILE_SIZE + 4,
        this.meleeSwing.row * TILE_SIZE + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8
      );
    }

    // 6. Draw HUD (Health Bars & Ammo Status)
    this.renderHUD(ctx);
  }

  renderHUD(ctx) {
    // Health Bars (Top Left)
    ctx.fillStyle = '#111';
    ctx.fillRect(10, 10, 110, 24);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(10, 10, 110, 24);

    for (let i = 0; i < this.maxHealth; i++) {
      ctx.fillStyle = i < this.health ? '#2ecc71' : '#555';
      ctx.fillRect(14 + i * 34, 14, 30, 16);
    }

    // Ammo Status Text (Top Right)
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = '#d4af37';
    let ammoText = `AMMO: ${this.clipAmmo}/${this.maxClipAmmo} | CLIPS: ${this.reserveClips}`;
    if (this.isWeaponThrown) {
      ammoText = 'WEAPON THROWN (NO GUN)';
    } else if (this.clipAmmo === 0 && this.reserveClips === 0) {
      ammoText = 'OUT OF AMMO [E TO THROW]';
    } else if (this.clipAmmo === 0) {
      ammoText = 'EMPTY CLIP [R TO RELOAD / E FOR MELEE]';
    }
    ctx.fillText(ammoText, canvas.width - 380, 26);
  }
}
