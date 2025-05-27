from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
from functools import wraps
import time

app = Flask(__name__)
CORS(app, origins=['https://qdiag.xyz'])

# MongoDB connection
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client.bmf_game
puzzles = db.puzzles

# In-memory rate limiting
rate_limit_store = {}

def rate_limit(max_requests=1, window=1):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.remote_addr
            now = time.time()
            
            # Clean old entries
            rate_limit_store[ip] = [t for t in rate_limit_store.get(ip, []) 
                                   if now - t < window]
            
            # Check rate limit
            if len(rate_limit_store.get(ip, [])) >= max_requests:
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            # Add current request
            if ip not in rate_limit_store:
                rate_limit_store[ip] = []
            rate_limit_store[ip].append(now)
            
            return f(*args, **kwargs)
        return wrapped
    return decorator

def clip_time(time_value):
    """Clip time between 1 and 3600 seconds"""
    try:
        time_int = int(time_value)
        return max(1, min(3600, time_int))
    except:
        return 1

@app.route('/puzzle/solve', methods=['POST'])
@rate_limit(max_requests=1, window=1)
def solve_puzzle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        puzzle_code = data.get('code')
        solve_time = data.get('time')
        user_id = data.get('userId')
        
        if not puzzle_code or solve_time is None:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Clip time to valid range
        solve_time = clip_time(solve_time)
        
        # Update or create puzzle document
        puzzle = puzzles.find_one({'_id': puzzle_code})
        
        if puzzle:
            # Update existing puzzle
            new_min_time = min(puzzle['min_time'], solve_time)
            puzzles.update_one(
                {'_id': puzzle_code},
                {
                    '$inc': {
                        'solves': 1,
                        'sum_time': solve_time
                    },
                    '$set': {
                        'min_time': new_min_time,
                        'last_updated': datetime.utcnow()
                    }
                }
            )
        else:
            # Create new puzzle entry
            puzzles.insert_one({
                '_id': puzzle_code,
                'stars': 0,
                'solves': 1,
                'sum_time': solve_time,
                'min_time': solve_time,
                'last_updated': datetime.utcnow()
            })
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        app.logger.error(f"Error in solve_puzzle: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/puzzle/star', methods=['POST'])
@rate_limit(max_requests=1, window=1)
def star_puzzle():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        puzzle_code = data.get('code')
        user_id = data.get('userId')
        
        if not puzzle_code:
            return jsonify({'error': 'Missing puzzle code'}), 400
        
        # Increment stars count
        result = puzzles.update_one(
            {'_id': puzzle_code},
            {
                '$inc': {'stars': 1},
                '$set': {'last_updated': datetime.utcnow()}
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Puzzle not found'}), 404
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        app.logger.error(f"Error in star_puzzle: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/puzzle/stats/<code>', methods=['GET'])
@rate_limit(max_requests=5, window=1)  # More lenient for GET requests
def get_puzzle_stats(code):
    try:
        puzzle = puzzles.find_one({'_id': code})
        
        if not puzzle:
            return jsonify({'error': 'Puzzle not found'}), 404
        
        # Calculate average time
        avg_time = puzzle['sum_time'] / puzzle['solves'] if puzzle['solves'] > 0 else 0
        
        return jsonify({
            'code': code,
            'stars': puzzle['stars'],
            'solves': puzzle['solves'],
            'min_time': puzzle['min_time'],
            'avg_time': round(avg_time, 1)
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error in get_puzzle_stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)