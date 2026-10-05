class StartScreen {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;

    // Menu State
    this.options = ['START A GAME', 'CONTROLS'];
    this.selectedIndex = 0;
    this.animTimer = 0;

    // Load Sprites for Visual Poses
    this.p1Sprite = new Image();
    this.p1Sprite.src = 'playersprite.png';

    this.p2Sprite = new Image();
    this.p2Sprite.src = 'player2sprite.jpg';
  }

  // Handle Input on Start Screen
  handleKeyDown(e) {
    const key = e.key.toLowerCase();

    if (key === 'w' || key === 'arrowup') {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
    } else if (key === 's' || key === 'arrowdown') {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    } else if (key === '1' || key === '5') {
      if (this.selectedIndex === 0) {
        return 'START_GAME'; // Signal game engine to transition to gameplay
      }
    }
    return null;
  }

  update() {
    this.animTimer += 0.05; // Drives idle breathing / pulse animation
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // 1. Dark Noir Background
    this.ctx.fillStyle = '#0f0f11';
    this.ctx.fillRect(0, 0, width, height);

    // Subtle center spotlight highlight
    const gradient = this.ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width / 1.2);
    gradient.addColorStop(0, '#1a1d24');
    gradient.addColorStop(1, '#08080a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    // 2. "SHOOT" Stencil Logo
    this.ctx.save();
    this.ctx.textAlign = 'center';

    // Shadow / Backdrop
    this.ctx.font = '900 72px "Impact", "Arial Black", sans-serif';
    this.ctx.fillStyle = '#050505';
    this.ctx.fillText('SHOOT', width / 2 + 4, 114);

    // Main Title Text
    this.ctx.fillStyle = '#e6e6e6';
    this.ctx.fillText('SHOOT', width / 2, 110);

    // Crimson Slash Graphic Accents (Matching Logo)
    this.ctx.strokeStyle = '#c0392b';
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.moveTo(width / 2 - 140, 100);
    this.ctx.lineTo(width / 2 + 140, 92);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(width / 2 - 100, 118);
    this.ctx.lineTo(width / 2 + 120, 112);
    this.ctx.stroke();
    this.ctx.restore();

    // 3. Standoff Character Poses (Animated Idle Bobbing)
    const bobOffset = Math.sin(this.animTimer) * 4;

    // Player 1 Pose (Left Side - Facing Right)
    if (this.p1Sprite.complete && this.p1Sprite.naturalWidth !== 0) {
      const frameW = this.p1Sprite.width / 7;
      const frameH = this.p1Sprite.height / 4;
      // Draw Right-facing row (Row 2), Shooting Frame (Col 3)
      this.ctx.drawImage(
        this.p1Sprite,
        3 * frameW, 2 * frameH, frameW, frameH,
        width / 2 - 200, 180 + bobOffset, 96, 96
      );
    }

    // Player 2 Pose (Right Side - Facing Left)
    if (this.p2Sprite.complete && this.p2Sprite.naturalWidth !== 0) {
      const frameW = this.p2Sprite.width / 7;
      const frameH = this.p2Sprite.height / 4;
      // Draw Left-facing row (Row 3), Shooting Frame (Col 3)
      this.ctx.drawImage(
        this.p2Sprite,
        3 * frameW, 3 * frameH, frameW, frameH,
        width / 2 + 104, 180 - bobOffset, 96, 96
      );
    }

    // 4. Centered Menu Options
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 22px "Segoe UI", sans-serif';

    this.options.forEach((option, index) => {
      const yPos = 320 + index * 45;
      const isSelected = index === this.selectedIndex;

      if (isSelected) {
        // Selection Arrow & Glow
        const pulse = Math.floor(Math.sin(this.animTimer * 2) * 5);
        this.ctx.fillStyle = '#d4af37';
        this.ctx.fillText(`>  ${option}  <`, width / 2, yPos);

        // Underline selection
        this.ctx.fillRect(width / 2 - 80, yPos + 8, 160, 2);
      } else {
        this.ctx.fillStyle = '#777777';
        this.ctx.fillText(option, width / 2, yPos);
      }
    });

    // 5. Prompt Footer
    const alpha = (Math.sin(this.animTimer * 1.5) + 1) / 2;
    this.ctx.fillStyle = `rgba(212, 175, 55, ${alpha.toFixed(2)})`;
    this.ctx.font = '14px "Segoe UI", sans-serif';
    this.ctx.fillText('PRESS [1] OR [5] TO BEGIN', width / 2, height - 35);
  }
}