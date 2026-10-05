import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

# Load embedding model once on initial server startup
model = SentenceTransformer('all-MiniLM-L6-v2')

# ---------------------------------------------------------------------------
# 1. EXPANDED HISTORICAL POPULATION (For Stable Feature Scaling)
# Metrics: [Accuracy, Shots, Blocks, Damage, SurvivalTime, Shot/Block Ratio, DPS]
# ---------------------------------------------------------------------------
HISTORICAL_POPULATION = np.array([
    # Aggressive Cluster
    [0.75, 48, 1, 180, 25, 48.00, 7.20],
    [0.60, 42, 0, 160, 30, 42.00, 5.33],
    [0.80, 55, 1, 200, 22, 55.00, 9.09],
    # Tactical / Defensive Cluster
    [0.45, 14, 9, 100, 75, 1.55, 1.33],
    [0.50, 18, 12, 120, 80, 1.50, 1.50],
    [0.40, 12, 8, 80, 65, 1.50, 1.23],
    # Sharpshooter Cluster
    [0.90, 10, 2, 180, 50, 5.00, 3.60],
    [0.85, 12, 1, 160, 55, 12.00, 2.90],
    # Balanced Cluster
    [0.60, 25, 4, 140, 45, 6.25, 3.11],
    [0.55, 28, 5, 150, 48, 5.60, 3.12]
])

# Fit scaler across full population so normalization parameters remain consistent
scaler = StandardScaler()
scaler.fit(HISTORICAL_POPULATION)

# ---------------------------------------------------------------------------
# 2. ARCHETYPE PROFILES & SEMANTIC DEFINITIONS
# ---------------------------------------------------------------------------
ARCHETYPES = {
    "Aggressive Rusher": {
        "stats": [0.72, 45, 1, 180, 28, 45.0, 6.42],
        "description": "High-velocity frontline assailant prioritizing relentless offensive fire, aggressive pushes, and rapid damage over cover."
    },
    "Tactical Defender": {
        "stats": [0.45, 18, 8, 120, 65, 2.25, 1.84],
        "description": "Patient, strategic builder relying on defensive cover walls, holding tight angles, zone control, and maximizing round survival."
    },
    "Precision Sharpshooter": {
        "stats": [0.88, 11, 2, 170, 52, 5.50, 3.26],
        "description": "Calculated marksman with high shot placement accuracy, low wasted ammo, selective engagements, and lethal damage efficiency."
    },
    "Balanced Combatant": {
        "stats": [0.58, 26, 4, 140, 46, 6.50, 3.04],
        "description": "Versatile dualist who adapts dynamically between building defensive cover and executing opportunistic combat pushes."
    }
}

# Pre-compute multi-modal baseline vectors for archetypes
archetype_names = list(ARCHETYPES.keys())
archetype_stats_matrix = np.array([ARCHETYPES[name]["stats"] for name in archetype_names])
archetype_descriptions = [ARCHETYPES[name]["description"] for name in archetype_names]

# Transform baseline numerical stats & text descriptions
archetype_num_scaled = scaler.transform(archetype_stats_matrix)
archetype_sem_vectors = model.encode(archetype_descriptions)
archetype_multimodal = np.hstack((archetype_num_scaled, archetype_sem_vectors))


# ---------------------------------------------------------------------------
# 3. VECTOR PROCESSING ENGINE FUNCTION
# ---------------------------------------------------------------------------
def process_match_vector(live_player_stats, match_summary_text=""):
    """
    Receives live telemetry [accuracy, shotsFired, blocksPlaced, damageDealt, survivalTime]
    and computes multi-modal similarity across expanded playstyle archetypes.
    """
    acc, shots, blocks, damage, survival = live_player_stats

    # Derive high-level feature metrics
    shot_block_ratio = float(shots) / max(blocks, 1)
    dps = float(damage) / max(survival, 1)

    full_live_stats = np.array([[acc, shots, blocks, damage, survival, shot_block_ratio, dps]])

    # Build enriched text summary encoding live performance traits
    enriched_summary = (
        f"Player logged {round(acc * 100, 1)}% hit accuracy across a {survival} second match. "
        f"Fired {shots} total rounds, dealt {damage} damage, and constructed {blocks} defensive cover blocks. "
        f"{match_summary_text}"
    )

    # Scale live stats & encode text vector
    live_num_scaled = scaler.transform(full_live_stats)
    live_sem_vector = model.encode([enriched_summary])
    live_multimodal = np.hstack((live_num_scaled, live_sem_vector))

    # Calculate Cosine Similarity Matrix
    raw_sims = cosine_similarity(live_multimodal, archetype_multimodal)[0]

    # Shift similarity scores to positive spectrum [0, 1] and compute percentages
    positive_sims = (raw_sims + 1) / 2
    match_percentages = (positive_sims / np.sum(positive_sims)) * 100

    # Primary Playstyle Classification
    top_idx = int(np.argmax(raw_sims))
    primary_playstyle = archetype_names[top_idx]

    # Generate Tactical Badges / Specialization Traits
    traits = []
    if acc >= 0.70:
        traits.append("High Precision")
    if blocks >= 4:
        traits.append("Fortress Builder")
    if dps >= 4.0:
        traits.append("Heavy Suppressor")
    if survival >= 60:
        traits.append("Endurance Survivor")
    if shot_block_ratio >= 15.0:
        traits.append("Aggressive Pusher")
    if not traits:
        traits.append("Adaptive Competitor")

    # Construct clean, expanded response object
    score_breakdown = {
        name: {
            "similarity_score": round(float(sim), 3),
            "match_percentage": f"{round(float(pct), 1)}%"
        }
        for name, sim, pct in zip(archetype_names, raw_sims, match_percentages)
    }

    return {
        "playstyle": primary_playstyle,
        "confidence": f"{round(float(match_percentages[top_idx]), 1)}%",
        "tactical_traits": traits,
        "archetype_breakdown": score_breakdown,
        "summary": enriched_summary,
        # Backward compatibility key for existing frontend calls
        "aggressive_similarity": round(float(raw_sims[0]), 3),
        "tactical_similarity": round(float(raw_sims[1]), 3)
    }