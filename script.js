const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// Game state
let gameRunning = false;
let score = 0;
let timeLeft = 60;
let animationId;
let timerInterval;

// Dragon (player)
const dragon = {
    x: 100,
    y: 250,
    width: 60,
    height: 40,
    speed: 5,
    dx: 0,
    dy: 0
};

// Stars (collectibles)
let stars = [];
const STAR_COUNT = 8;

// Trees and park decorations
const trees = [];
const clouds = [];

// Keys
const keys = {};

// Initialize park elements
function initPark() {
    // Trees
    for (let i = 0; i < 12; i++) {
        trees.push({
            x: Math.random() * canvas.width,
            y: 350 + Math.random() * 100,
            size: 30 + Math.random() * 40
        });
    }
    // Clouds
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: 30 + Math.random() * 80,
            size: 40 + Math.random() * 30,
            speed: 0.3 + Math.random() * 0.5
        });
    }
}

// Spawn stars
function spawnStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: 50 + Math.random() * (canvas.width - 100),
            y: 50 + Math.random() * (canvas.height - 150),
            size: 15,
            collected: false,
            pulse: Math.random() * Math.PI * 2
        });
    }
}

// Draw dragon (cute friendly dragon)
function drawDragon() {
    const { x, y, width, height } = dragon;
    
    // Body
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(x + width/2, y + height/2, width/2, height/2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.beginPath();
    ctx.ellipse(x + width + 5, y + height/2 - 5, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings
    ctx.fillStyle = '#ee5a24';
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 10);
    ctx.quadraticCurveTo(x - 20, y - 30, x + 10, y + 5);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 25);
    ctx.quadraticCurveTo(x - 15, y + 50, x + 15, y + 30);
    ctx.fill();
    
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + width + 12, y + height/2 - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + width + 14, y + height/2 - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Smile
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + width + 10, y + height/2 + 2, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
    
    // Saddle (important!)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 15, y + 5, 30, 12);
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(x + 18, y + 7, 24, 8);
    
    // Tail
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(x, y + height/2);
    ctx.quadraticCurveTo(x - 30, y + height/2 - 20, x - 40, y + height/2 + 10);
    ctx.quadraticCurveTo(x - 25, y + height/2 + 5, x, y + height/2 + 5);
    ctx.fill();
}

// Draw star
function drawStar(star) {
    if (star.collected) return;
    
    const pulse = Math.sin(star.pulse) * 3;
    const size = star.size + pulse;
    
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.rotate(star.pulse * 0.5);
    
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * size,
                   Math.sin((18 + i * 72) * Math.PI / 180) * size);
        ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * size * 0.5,
                   Math.sin((54 + i * 72) * Math.PI / 180) * size * 0.5);
    }
    ctx.closePath();
    ctx.fill();
    
    // Glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
    ctx.fill();
    
    ctx.restore();
    star.pulse += 0.1;
}

// Draw tree
function drawTree(tree) {
    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(tree.x - 8, tree.y, 16, tree.size * 0.6);
    
    // Foliage
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y - 10, tree.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tree.x - 15, tree.y + 5, tree.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tree.x + 15, tree.y + 5, tree.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

// Draw cloud
function drawCloud(cloud) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.4, cloud.y - 5, cloud.size * 0.4, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.7, cloud.y, cloud.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
}

// Draw background (park)
function drawBackground() {
    // Sky gradient already on canvas bg, but enhance
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(0.6, '#98D8C8');
    gradient.addColorStop(1, '#7CFC00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Ground details
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 400, canvas.width, 100);
    
    // Path
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(0, 420, canvas.width, 40);
    
    // Clouds
    clouds.forEach(cloud => {
        drawCloud(cloud);
        cloud.x += cloud.speed;
        if (cloud.x > canvas.width + 50) cloud.x = -50;
    });
    
    // Trees
    trees.forEach(drawTree);
}

// Update dragon position
function updateDragon() {
    dragon.dx = 0;
    dragon.dy = 0;
    
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dragon.dx = -dragon.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dragon.dx = dragon.speed;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dragon.dy = -dragon.speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dragon.dy = dragon.speed;
    
    dragon.x += dragon.dx;
    dragon.y += dragon.dy;
    
    // Boundaries
    dragon.x = Math.max(0, Math.min(canvas.width - dragon.width - 30, dragon.x));
    dragon.y = Math.max(20, Math.min(canvas.height - dragon.height - 50, dragon.y));
}

// Check collisions with stars
function checkCollisions() {
    stars.forEach(star => {
        if (star.collected) return;
        
        const dx = (dragon.x + dragon.width/2) - star.x;
        const dy = (dragon.y + dragon.height/2) - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 40) {
            star.collected = true;
            score += 10;
            scoreEl.textContent = score;
            
            // Fun message from the dragon
            const messages = [
                "Отлично! Звёздочка поймана! ✨",
                "Ура! Ещё одна! Ты крутой наездник!",
                "Мяу... ой, я дракон! Хватай больше! 🐉",
                "С седла видно лучше — ещё звезду!",
                "Ты мой любимый наездник! ❤️"
            ];
            messageEl.textContent = messages[Math.floor(Math.random() * messages.length)];
            setTimeout(() => { if (gameRunning) messageEl.textContent = ''; }, 1500);
        }
    });
}

// Main game loop
function gameLoop() {
    if (!gameRunning) return;
    
    drawBackground();
    stars.forEach(drawStar);
    updateDragon();
    drawDragon();
    checkCollisions();
    
    // Check if all stars collected
    if (stars.every(s => s.collected)) {
        spawnStars();
        messageEl.textContent = "Все звёзды собраны! Новые появились! 🌟";
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    score = 0;
    timeLeft = 60;
    scoreEl.textContent = score;
    timerEl.textContent = timeLeft;
    messageEl.textContent = "Полетели, мой наездник! Собирай звёзды! 🚀";
    
    dragon.x = 100;
    dragon.y = 250;
    
    spawnStars();
    gameRunning = true;
    
    startBtn.style.display = 'none';
    restartBtn.style.display = 'none';
    
    // Timer
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    gameLoop();
}

// End game
function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    clearInterval(timerInterval);
    
    messageEl.textContent = `Время вышло! Ты собрал ${score} очков! Я горжусь тобой! 🐉❤️`;
    restartBtn.style.display = 'inline-block';
}

// Event listeners
document.addEventListener('keydown', e => {
    keys[e.key] = true;
    // Prevent scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', e => {
    keys[e.key] = false;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Init
initPark();
drawBackground();
drawDragon();
messageEl.textContent = "Нажми «Начать игру!» и садись в седло, мой друг! 🐉";