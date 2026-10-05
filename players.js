// --- GLOBAL DESTRUCTIBLE TILE TRACKER ---
const tableHealthMap = {}; // Tracks HP for Mahogany Tables (Tile 2)

function damageTable(row, col, damage) {
  const key = `${row},${col}`;
  if (tableHealthMap[key] === undefined) {
    tableHealthMap[key] = 3; // Table starts with 3 HP
  }

  tableHealthMap[key] -= damage;

  if (tableHealthMap[key] <= 0) {
    mapTheRoom[row][col] = 0; // Destroy table and revert to empty floor
    delete tableHealthMap[key];
  }
}

// Global reference array to track all active players
const allPlayers = [];

class Player {
  constructor(startCol, startRow, options = {}) {
    // Grid Coordinates & Facing Direction
    this.col = startCol;
    this.row = startRow;
    this.facing = 'DOWN'; // 'UP', 'DOWN', 'LEFT', 'RIGHT'

    // Player Identification & HUD Layout
    this.playerNumber = options.playerNumber || (allPlayers.length + 1);

    // Configurable Key Controls (Defaults: Player 1 = WASD/Space/Shift/E/R, Player 2 = Arrows/Enter/Ctrl/M/K)
    const isP2 = this.playerNumber === 2;
    this.controls = options.controls || {
      up: isP2 ? 'arrowup' : 'w',
      down: isP2 ? 'arrowdown' : 's',
      left: isP2 ? 'arrowleft' : 'a',
      right: isP2 ? 'arrowright' : 'd',
      shoot: isP2 ? 'Enter' : 'Space',
      placeBlock: isP2 ? 'L' : 'Shift',
      actionE: isP2 ? 'm' : 'e',
      reload: isP2 ? 'k' : 'r'
    };

    // --- SPRITE SHEET INTEGRATION & TRANSPARENCY ---
    this.sprite = new Image();
    this.sprite.src = options.spriteSrc || (isP2 ? 'player2sprite.jpg' : 'playersprite.png');
    this.transparentCanvas = null;

    // Remove baked-in checkerboard background once image loads
    this.sprite.onload = () => {
      this.transparentCanvas = this.makeTransparent(this.sprite);
    };

    this.cols = 7; // 7 frames per row
    this.rows = 4; // 4 directional rows
    
    // Directional Row Mappings for sprite sheet
    // Row 0 = DOWN (Front-facing)
    // Row 1 = UP (Back-facing)
    // Row 2 = RIGHT
    // Row 3 = LEFT
    this.dirRows = {
      'DOWN': 0,
      'UP': 1,
      'RIGHT': 2,
      'LEFT': 3
    };

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

    // Active Objects & Placed Blocks
    this.bullets = [];
    this.thrownWeapons = [];
    this.meleeSwing = null; // Temporary melee hit visual
    this.placedBlocks = []; // Active player-placed blocks (Max 2)

    // Movement Repeat Timers (0.67s delay when held)
    this.moveDelay = 670; // 0.67 seconds in milliseconds
    this.keyPressTimes = {};
    this.keyHeldTimers = {};

    // Input States
    this.activeMoveKey = null;

    allPlayers.push(this);
    this.setupControls();
  }

  // --- DAMAGE HELPER ---
  takeDamage(amount = 1) {
    this.health = Math.max(0, this.health - amount);
  }

  // Filter out background pixels for transparency
  makeTransparent(img) {
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const isGrayscale = Math.abs(r - g) <= 20 && Math.abs(g - b) <= 20;
      const isBackgroundGrey = r >= 115;

      if (isGrayscale && isBackgroundGrey) {
        data[i + 3] = 0; // Transparent
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // --- INPUT EVENT LISTENERS ---
  setupControls() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const code = e.code;

      const moveKeys = [
        this.controls.up.toLowerCase(),
        this.controls.down.toLowerCase(),
        this.controls.left.toLowerCase(),
        this.controls.right.toLowerCase()
      ];

      // Handle Movement
      if (moveKeys.includes(key)) {
        if (this.activeMoveKey !== key) {
          this.activeMoveKey = key;
          this.handleStep(key);

          clearInterval(this.keyHeldTimers[key]);
          this.keyHeldTimers[key] = setInterval(() => {
            if (this.activeMoveKey === key) {
              this.handleStep(key);
            }
          }, this.moveDelay);
        }
      }

      // Shoot Bullet
      if (key === this.controls.shoot.toLowerCase() || code === this.controls.shoot) {
        e.preventDefault();
        this.shoot();
      }

      // Place Block
      if (key === this.controls.placeBlock.toLowerCase() || e.key === this.controls.placeBlock) {
        e.preventDefault();
        this.placeBlock();
      }

      // Melee Attack or Weapon Throw
      if (key === this.controls.actionE.toLowerCase()) {
        this.handleEAction();
      }

      // Reload
      if (key === this.controls.reload.toLowerCase()) {
        this.reload();
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      const moveKeys = [
        this.controls.up.toLowerCase(),
        this.controls.down.toLowerCase(),
        this.controls.left.toLowerCase(),
        this.controls.right.toLowerCase()
      ];

      if (moveKeys.includes(key)) {
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

    const k = key.toLowerCase();
    if (k === this.controls.up.toLowerCase()) {
      this.facing = 'UP';
      targetRow--;
    } else if (k === this.controls.down.toLowerCase()) {
      this.facing = 'DOWN';
      targetRow++;
    } else if (k === this.controls.left.toLowerCase()) {
      this.facing = 'LEFT';
      targetCol--;
    } else if (k === this.controls.right.toLowerCase()) {
      this.facing = 'RIGHT';
      targetCol++;
    }

    if (this.isWalkable(targetCol, targetRow)) {
      this.col = targetCol;
      this.row = targetRow;
    }
  }

  isWalkable(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    return mapTheRoom[row][col] === 0; // Floor tile
  }

  getFrontTile() {
    let frontCol = this.col;
    let frontRow = this.row;

    if (this.facing === 'UP') frontRow--;
    if (this.facing === 'DOWN') frontRow++;
    if (this.facing === 'LEFT') frontCol--;
    if (this.facing === 'RIGHT') frontCol++;

    return { col: frontCol, row: frontRow };
  }

  placeBlock() {
    const front = this.getFrontTile();

    if (
      front.col >= 0 && front.col < COLS &&
      front.row >= 0 && front.row < ROWS &&
      mapTheRoom[front.row][front.col] === 0
    ) {
      if (this.placedBlocks.length >= 2) {
        const oldest = this.placedBlocks.shift();
        mapTheRoom[oldest.r][oldest.c] = 0;
      }

      mapTheRoom[front.row][front.col] = 4;
      this.placedBlocks.push({
        r: front.row,
        c: front.col,
        hp: 3,
        createdAt: Date.now(),
        duration: 5000
      });

      // --- STEP 2 HOOK: RECORD BLOCK PLACED ---
      if (typeof statKeeper !== 'undefined' && statKeeper) {
  statKeeper.logBlockPlaced(this.playerNumber);
      }
    }
  }

  updateBlocks() {
    const now = Date.now();
    for (let i = this.placedBlocks.length - 1; i >= 0; i--) {
      const block = this.placedBlocks[i];
      if (now - block.createdAt >= block.duration || block.hp <= 0) {
        mapTheRoom[block.r][block.c] = 0;
        this.placedBlocks.splice(i, 1);
      }
    }
  }

  shoot() {
    if (this.isWeaponThrown) return;

    if (this.clipAmmo > 0) {
      this.clipAmmo--;

      const startX = this.col * TILE_SIZE + TILE_SIZE / 2;
      const startY = this.row * TILE_SIZE + TILE_SIZE / 2;

      this.bullets.push({
        x: startX,
        y: startY,
        startX: startX,
        startY: startY,
        facing: this.facing
      });

      // --- STEP 2 HOOK: RECORD SHOT FIRED ---
      if (window.statKeeper) {
        statKeeper.logShot(this.playerNumber);
      }
    }
  }

  reload() {
    if (this.reserveClips > 0 && this.clipAmmo < this.maxClipAmmo) {
      this.reserveClips--;
      this.clipAmmo = this.maxClipAmmo;
    }
  }

  handleEAction() {
    if (this.isWeaponThrown) return;

    if (this.clipAmmo === 0 && this.reserveClips === 0) {
      this.throwWeapon();
    } else if (this.clipAmmo === 0) {
      this.performMelee();
    }
  }

  performMelee() {
    const front = this.getFrontTile();
    this.meleeSwing = {
      col: front.col,
      row: front.row,
      timer: 10
    };

    if (front.row >= 0 && front.row < ROWS && front.col >= 0 && front.col < COLS) {
      const targetTile = mapTheRoom[front.row][front.col];
      
      if (targetTile === 2) {
        damageTable(front.row, front.col, 1.5);
      }
    }
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
      facing: this.facing
    });
  }

  update() {
    this.updateBlocks();

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.facing === 'UP') b.y -= this.bulletSpeed;
      if (b.facing === 'DOWN') b.y += this.bulletSpeed;
      if (b.facing === 'LEFT') b.x -= this.bulletSpeed;
      if (b.facing === 'RIGHT') b.x += this.bulletSpeed;

      const currentDist = Math.hypot(b.x - b.startX, b.y - b.startY);
      const gridCol = Math.floor(b.x / TILE_SIZE);
      const gridRow = Math.floor(b.y / TILE_SIZE);

      const isOutOfBounds = gridCol < 0 || gridCol >= COLS || gridRow < 0 || gridRow >= ROWS;

      if (isOutOfBounds) {
        this.bullets.splice(i, 1);
        continue;
      }

      const hitTile = mapTheRoom[gridRow][gridCol];

      if (hitTile !== 0) {
        if (hitTile === 2) {
          damageTable(gridRow, gridCol, 1);
        } else if (hitTile === 4) {
          allPlayers.forEach(p => {
            const blk = p.placedBlocks.find(b => b.r === gridRow && b.c === gridCol);
            if (blk) blk.hp -= 1;
          });
        }

        this.bullets.splice(i, 1);
        continue;
      }

      if (currentDist >= this.bulletMaxDistance) {
        this.bullets.splice(i, 1);
      }
    }

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

      if (currentDist >= this.throwMaxDistance || hitWall) {
        this.thrownWeapons.splice(i, 1);
      }
    }

    if (this.meleeSwing) {
      this.meleeSwing.timer--;
      if (this.meleeSwing.timer <= 0) {
        this.meleeSwing = null;
      }
    }
  }

  render(ctx) {
    const px = this.col * TILE_SIZE;
    const py = this.row * TILE_SIZE;

    const spriteToDraw = this.transparentCanvas || (this.sprite.complete && this.sprite.naturalWidth !== 0 ? this.sprite : null);

    // 1. Draw Player Sprite
    if (!spriteToDraw) {
      ctx.fillStyle = this.playerNumber === 1 ? '#1c3144' : '#4a1c1c';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    } else {
      const frameWidth = spriteToDraw.width / this.cols;
      const frameHeight = spriteToDraw.height / this.rows;

      let frameCol = 0; // Default standing frame for all directions

      if (this.meleeSwing) {
        frameCol = 6; // Melee / throw frame
      } else if (this.bullets.length > 0) {
        frameCol = 3; // Firing frame
      }

      const padX = 6;
      const padY = 4;

      const sx = frameCol * frameWidth + padX;
      const sy = this.dirRows[this.facing] * frameHeight + padY;
      const sw = frameWidth - (padX * 2);
      const sh = frameHeight - (padY * 2);

      ctx.drawImage(
        spriteToDraw,
        sx, sy, sw, sh,
        px - 2, py, TILE_SIZE, TILE_SIZE
      );
    }

    // 2. Bullets
    ctx.fillStyle = '#ffcc00';
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Thrown Weapon
    ctx.fillStyle = '#aaaaaa';
    for (const w of this.thrownWeapons) {
      ctx.fillRect(w.x - 6, w.y - 6, 12, 12);
    }

    // 4. Melee Slash
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

    // 5. Draw HUD
    this.renderHUD(ctx);
  }

  renderHUD(ctx) {
    const isP1 = this.playerNumber === 1;

    // Position Player 1 HUD on the left, Player 2 HUD on the right
    const healthX = isP1 ? 12 : canvas.width - 150;
    const textX = isP1 ? 300 : canvas.width - 300;

    // Health Bars
    ctx.fillStyle = '#111';
    ctx.fillRect(healthX, 4, 110, 20);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(healthX, 4, 110, 20);

    for (let i = 0; i < this.maxHealth; i++) {
      ctx.fillStyle = i < this.health ? (isP1 ? '#2ecc71' : '#e74c3c') : '#555';
      ctx.fillRect(healthX + 4 + i * 34, 8, 28, 12);
    }

    // Ammo Status Text
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#d4af37';

    let actionHint = isP1 ? 'E TO THROW / R TO RELOAD' : 'M TO THROW / K TO RELOAD';
    let ammoText = `P${this.playerNumber} AMMO: ${this.clipAmmo}/${this.maxClipAmmo} | CLIPS: ${this.reserveClips}`;

    if (this.isWeaponThrown) {
      ammoText = `P${this.playerNumber}: WEAPON THROWN`;
    } else if (this.clipAmmo === 0 && this.reserveClips === 0) {
      ammoText = `P${this.playerNumber}: OUT OF AMMO [${isP1 ? 'E' : 'M'} TO THROW]`;
    } else if (this.clipAmmo === 0) {
      ammoText = `P${this.playerNumber}: EMPTY CLIP [${isP1 ? 'R' : 'K'} TO RELOAD]`;
    }

    ctx.fillText(ammoText, textX, 18);
  }
}
