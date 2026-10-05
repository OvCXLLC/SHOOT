# SHOOT

SHOOT is a 2D top-down, grid-based mafia shooter built with HTML5 Canvas, JavaScript, and a Python Flask backend. It combines fast-paced tactical gunplay, destructible cover placement, and a machine learning telemetry pipeline that analyzes player strategy using multi-modal feature vectors.

Key Features
Grid-Based Tactical Movement: Pixel-art mafia characters navigating a tile grid with precise directional movement and continuous key-hold timing.

Resource & Weapon Management: Manage magazine clips, reload timing, close-range melee strikes, and last-resort gun throwing.

Dynamic Cover Placement: Instantly deploy destructible concrete barriers directly ahead to block incoming bullet paths and secure choke points.

Multi-Modal Data Science Pipeline: Match telemetry is transmitted to a Python Flask server, where Scikit-Learn and Sentence Transformers evaluate player stats to classify playstyles (e.g., Aggressive vs. Tactical/Defensive).

# Controls 
Player 1
Movement	W A S D	
Step up, left, down, or right across the map grid

Shoot	Spacebar	
Fire pistol in facing direction

Place Block	Left Shift	
Instantly deploy a defensive cover block in front

Melee / Throw	E	
Perform melee strike (empty clip) or throw gun (0 ammo remaining)

Reload	R	
Reload clip from reserve ammunition

# Player 2
Movement	Up Down Left Right	
Step up, down, left, or right across the map grid

Shoot	Enter	
Fire pistol in facing direction

Place Block	Right Control	
Instantly deploy a defensive cover block in front

Melee / Throw	M	
Perform melee strike (empty clip) or throw gun (0 ammo remaining)

Reload	K	
Reload clip from reserve ammunition
