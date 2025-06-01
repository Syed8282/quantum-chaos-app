// Backend simulation server using Node.js and Express

const express = require('express');
const crypto = require('crypto');
const cors = require('cors'); // Import cors
const app = express();
const port = 3000;

// Enable CORS for all routes (or specific origins if needed for production)
app.use(cors());
app.use(express.json());

let backendRadius = 300; // Fixed radius for backend simulation
let collisionCount = 0;
const MAX_BALLS = 25;
let balls = [];
let noiseSeed = crypto.randomBytes(16);
let speedTable = Array.from({ length: 256 }, (_, i) => 0.96 + (i / 255 * 0.08));

function cryptoRandom() {
    return crypto.randomBytes(4).readUInt32BE() / 4294967296;
}

class QuantumBall {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (cryptoRandom() - 0.5) * 8;
        this.vy = (cryptoRandom() - 0.5) * 8;
        this.radius = 5;
        this.trail = []; // Trail is managed by the backend simulation
        this.speedFactor = speedTable[Math.floor(cryptoRandom() * 256)];
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 15) this.trail.shift();
    }
}

function handleCollision(ball) {
    // Note: The radius used here is the backendRadius (300)
    const dx = ball.x - backendRadius;
    const dy = ball.y - backendRadius;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const overlap = dist + ball.radius - backendRadius;

    if (overlap > 0) {
        noiseSeed = crypto.randomBytes(16);

        const nx = dx / dist;
        const ny = dy / dist;
        const dot = 2 * (ball.vx * nx + ball.vy * ny);

        ball.vx = (ball.vx - dot * nx) * ball.speedFactor;
        ball.vy = (ball.vy - dot * ny) * ball.speedFactor;

        ball.vx += (cryptoRandom() - 0.5) * 0.2;
        ball.vy += (cryptoRandom() - 0.5) * 0.2;

        ball.x = backendRadius + (backendRadius - ball.radius - 1) * (ball.x - backendRadius) / dist;
        ball.y = backendRadius + (backendRadius - ball.radius - 1) * (ball.y - backendRadius) / dist;

        if (balls.length < MAX_BALLS && cryptoRandom() > 0.7) {
            balls.push(new QuantumBall(ball.x, ball.y));
        }

        collisionCount++;
    }
}

async function generateEntropyHash() {
    const state = {
        seed: noiseSeed.toString('hex'), // noiseSeed is a Buffer, toString('hex') works here
        timestamp: Date.now(),
        balls: balls.map(b => ({
            x: b.x.toFixed(3),
            y: b.y.toFixed(3),
            vx: b.vx.toFixed(5),
            vy: b.vy.toFixed(5),
            trail: b.trail.map(t => ({x: t.x.toFixed(3), y: t.y.toFixed(3)})) // Include trail data
        }))
    };

    const hash = crypto.createHash('sha256')
        .update(JSON.stringify(state))
        .digest('hex');

    return hash;
}

// API to initialize simulation
app.post('/start', (req, res) => {
    balls = [
        new QuantumBall(backendRadius + 50, backendRadius),
        new QuantumBall(backendRadius - 50, backendRadius),
        new QuantumBall(backendRadius, backendRadius + 50)
    ];
    collisionCount = 0; // Reset collision count on start
    res.json({ status: 'Simulation started', balls, radius: backendRadius, collisionCount });
});

// API to step simulation
app.post('/step', async (req, res) => {
    balls.forEach(ball => {
        ball.update();
        handleCollision(ball);
    });
    const hash = await generateEntropyHash();
    res.json({ balls, hash, collisionCount, radius: backendRadius });
});

app.listen(port, () => {
    console.log(`Quantum Chaos backend running at http://localhost:${port}`);
});
