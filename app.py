from flask import Flask, request, jsonify
from flask_cors import CORS
from shootdata import process_match_vector

app = Flask(__name__)
CORS(app)

@app.route('/api/match_stats', methods=['POST'])
@app.route('/api/submit_stats', methods=['POST'])
def submit_stats():
    data = request.json or {}
    
    players_data = data.get('players', {})
    p1_raw = players_data.get('p1', {})
    p2_raw = players_data.get('p2', {})
    duration = data.get('roundDurationSeconds', 30)

    # --- P1 METRICS ---
    p1_acc = (p1_raw.get('shotsHit', 0) / p1_raw.get('shotsFired', 1)) if p1_raw.get('shotsFired', 0) > 0 else 0.0
    p1_metrics = [p1_acc, p1_raw.get('shotsFired', 0), p1_raw.get('blocksPlaced', 0), p1_raw.get('shotsHit', 0) * 20, duration]
    
    # --- P2 METRICS ---
    p2_acc = (p2_raw.get('shotsHit', 0) / p2_raw.get('shotsFired', 1)) if p2_raw.get('shotsFired', 0) > 0 else 0.0
    p2_metrics = [p2_acc, p2_raw.get('shotsFired', 0), p2_raw.get('blocksPlaced', 0), p2_raw.get('shotsHit', 0) * 20, duration]

    # Process Multi-Modal Vector Analysis
    p1_analysis = process_match_vector(p1_metrics)
    p2_analysis = process_match_vector(p2_metrics)

    print("\n========================================================")
    print("        EXPANDED MULTI-MODAL VECTOR ANALYSIS            ")
    print("========================================================")
    print(f"PLAYER 1 Class  : {p1_analysis['playstyle']} ({p1_analysis['confidence']} match)")
    print(f"Tactical Traits : {', '.join(p1_analysis['tactical_traits'])}")
    print("Archetype Breakdown:")
    for style, stats in p1_analysis['archetype_breakdown'].items():
        print(f"  - {style:<22} : {stats['match_percentage']} (Score: {stats['similarity_score']})")
    print("--------------------------------------------------------")
    print(f"PLAYER 2 Class  : {p2_analysis['playstyle']} ({p2_analysis['confidence']} match)")
    print(f"Tactical Traits : {', '.join(p2_analysis['tactical_traits'])}")
    print("Archetype Breakdown:")
    for style, stats in p2_analysis['archetype_breakdown'].items():
        print(f"  - {style:<22} : {stats['match_percentage']} (Score: {stats['similarity_score']})")
    print("========================================================\n")

    return jsonify({
        "status": "success",
        "analysis": {
            "p1": p1_analysis,
            "p2": p2_analysis
        }
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)