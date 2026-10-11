// ==========================================
// STARTSCREEN.JS - MENU ROUTER & AI SELECT
// ==========================================

class StartScreen {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Menu States: 'MAIN', 'AI_SELECT', 'CONTROLS'
    this.menuState = 'MAIN';
    this.mainOptions = ['1: LOCAL PVP (2 PLAYERS)', '5: VS AI MODE', 'CONTROLS'];
    this.aiOptions = ['LEVEL 1: THE INITIATE', 'LEVEL 2: THE ENFORCER', 'LEVEL 3: THE DON (BOSS)'];
    
    this.selectedIndex = 0;
    this.animTimer = 0;

    // Start screen artwork (falls back to the noir background if the file is missing)
    this.bgImage = new Image();
    this.bgImage.src = 'Startscreen.png';

    // Load Sprites for Visual Poses[cite: 3]
    this.p1Sprite = new Image();
    this.p1Sprite.src = 'playersprite.png';
    this.p2Sprite = new Image();
    this.p2Sprite.src = 'player2sprite.png';
  }

  handleKeyDown(e) {
    const key = e.key.toLowerCase();

    // Controls screen: any back/confirm key returns to the main menu
    if (this.menuState === 'CONTROLS') {
      if (key === 'escape' || key === 'enter' || key === ' ' || key === 'backspace') {
        this.menuState = 'MAIN';
        this.selectedIndex = 2;
      }
      return null;
    }

    // Direct Shortcut Keys on Main Screen[cite: 3]
    if (this.menuState === 'MAIN') {
      if (key === '1') return { action: 'START_GAME', mode: 'PVP' };
      if (key === '5') {
        this.menuState = 'AI_SELECT';
        this.selectedIndex = 0;
        return null;
      }
    }

    // Navigation Keys
    if (key === 'w' || key === 'arrowup') {
      const currentList = this.menuState === 'MAIN' ? this.mainOptions : this.aiOptions;
      this.selectedIndex = (this.selectedIndex - 1 + currentList.length) % currentList.length;
    } else if (key === 's' || key === 'arrowdown') {
      const currentList = this.menuState === 'MAIN' ? this.mainOptions : this.aiOptions;
      this.selectedIndex = (this.selectedIndex + 1) % currentList.length;
    } else if (key === 'enter' || key === ' ') {
      if (this.menuState === 'MAIN') {
        if (this.selectedIndex === 0) return { action: 'START_GAME', mode: 'PVP' };
        else if (this.selectedIndex === 1) {
          this.menuState = 'AI_SELECT';
          this.selectedIndex = 0;
        } else if (this.selectedIndex === 2) {
          this.menuState = 'CONTROLS';
        }
      } else if (this.menuState === 'AI_SELECT') {
        const selectedLevel = this.selectedIndex + 1; // Level 1, 2, or 3
        return { action: 'START_GAME', mode: 'VS_AI', level: selectedLevel };
      }
    } else if (key === 'escape' && this.menuState === 'AI_SELECT') {
      this.menuState = 'MAIN';
      this.selectedIndex = 0;
    }

    return null;
  }

  update() {
    this.animTimer += 0.05;
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;
    const hasArt = this.bgImage.complete && this.bgImage.naturalWidth !== 0;

    ctx.save();
    ctx.textAlign = 'center';

    // Background: artwork if available, otherwise Dark Noir[cite: 3]
    if (hasArt) {
      ctx.drawImage(this.bgImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#0f0f11';
      ctx.fillRect(0, 0, width, height);

      // Title Logo Header[cite: 3]
      ctx.font = '900 64px "Impact", sans-serif';
      ctx.fillStyle = '#e6e6e6';
      ctx.fillText('SHOOT', width / 2, 90);

      // Crimson Slash Graphic Accents[cite: 3]
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(width / 2 - 120, 80);
      ctx.lineTo(width / 2 + 120, 74);
      ctx.stroke();
    }

    // Menu panel (also covers the "START A GAME" text baked into the artwork)
    const onControls = this.menuState === 'CONTROLS';
    const panelW = 460;
    const panelY = onControls ? 170 : 205;
    const panelH = onControls ? 300 : 235;
    ctx.fillStyle = '#0d0f13'; // opaque so the text baked into the artwork doesn't show through
    ctx.fillRect(width / 2 - panelW / 2, panelY, panelW, panelH);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(width / 2 - panelW / 2, panelY, panelW, panelH);

    // Menu Title
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#d4af37';
    const subTitle = onControls ? 'CONTROLS (ESC TO BACK)'
      : this.menuState === 'MAIN' ? 'SELECT GAME MODE' : 'SELECT AI LEVEL (ESC TO BACK)';
    ctx.fillText(subTitle, width / 2, panelY + 38);

    if (onControls) {
      this.renderControls(panelY);
    } else {
      // Render Active Menu Items
      const options = this.menuState === 'MAIN' ? this.mainOptions : this.aiOptions;
      options.forEach((option, index) => {
        const yPos = panelY + 87 + index * 42;
        const isSelected = index === this.selectedIndex;

        ctx.font = isSelected ? 'bold 22px "Segoe UI"' : '18px "Segoe UI"';
        ctx.fillStyle = isSelected ? '#2ecc71' : '#aaaaaa';
        ctx.fillText(isSelected ? `> ${option} <` : option, width / 2, yPos);
      });

      ctx.font = '13px "Segoe UI", sans-serif';
      ctx.fillStyle = '#777777';
      ctx.fillText('W / S + ENTER TO SELECT', width / 2, panelY + panelH - 14);
    }

    ctx.restore();
  }

  renderControls(panelY) {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const lines = [
      { t: 'PLAYER 1', c: '#2ecc71', b: true },
      { t: 'W A S D move  |  SPACE shoot  |  SHIFT block', c: '#dddddd' },
      { t: 'E melee / throw  |  R reload', c: '#dddddd' },
      { t: 'PLAYER 2 (or the AI in VS AI mode)', c: '#e74c3c', b: true },
      { t: 'ARROWS move  |  ENTER shoot  |  L block', c: '#dddddd' },
      { t: 'M melee / throw  |  K reload', c: '#dddddd' },
      { t: 'P  -  PAUSE / RESUME', c: '#d4af37', b: true }
    ];
    let y = panelY + 76;
    lines.forEach((ln, i) => {
      if (i === 3 || i === 6) y += 12; // gap between sections
      ctx.font = (ln.b ? 'bold 15px' : '14px') + ' "Segoe UI", sans-serif';
      ctx.fillStyle = ln.c;
      ctx.fillText(ln.t, cx, y);
      y += 26;
    });
  }
}
