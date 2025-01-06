
// Import Firebase functions from window object since they were made global in HTML
const { initializeApp, getDatabase, ref, push, remove, onValue, serverTimestamp } = window;
const firebaseConfig = {
    apiKey: "AIzaSyCwdYMuJ2UiMyBeXk1iWXoSflwzjjpE8pM",
    authDomain: "realtime-collab-whiteboard.firebaseapp.com",
    projectId: "realtime-collab-whiteboard",
    storageBucket: "realtime-collab-whiteboard.firebasestorage.app",
    messagingSenderId: "150079160307",
    appId: "1:150079160307:web:0ab57b351d1891f4e39c86"
  };


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const strokesRef = ref(database, 'strokes');

// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

// Drawing state
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'pencil';
let currentColor = '#000000';
let currentLineWidth = 2;

// Set initial canvas size
function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Tool selection
const tools = ['pencil', 'eraser'];
tools.forEach(tool => {
    document.getElementById(tool).addEventListener('click', () => {
        tools.forEach(t => document.getElementById(t).classList.remove('active'));
        document.getElementById(tool).classList.add('active');
        currentTool = tool;
    });
});

// Color picker
document.getElementById('colorPicker').addEventListener('input', (e) => {
    currentColor = e.target.value;
});

// Line width
document.getElementById('lineWidth').addEventListener('input', (e) => {
    currentLineWidth = parseInt(e.target.value);
});

// Drawing functions
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.lineWidth = currentLineWidth;
    ctx.lineCap = 'round';

    switch (currentTool) {
        case 'pencil':
        case 'eraser':
            drawFreehand(currentX, currentY);
            break;
    }

    lastX = currentX;
    lastY = currentY;
}

function drawFreehand(x, y) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Save stroke to Firebase
    saveStroke({
        tool: currentTool,
        startX: lastX,
        startY: lastY,
        endX: x,
        endY: y
    });
}

function stopDrawing(e) {
    if (!isDrawing) return;
    
    isDrawing = false;
}

function saveStroke(strokeData) {
    const stroke = {
        tool: strokeData.tool,
        color: currentColor,
        lineWidth: currentLineWidth,
        points: {
            startX: strokeData.startX,
            startY: strokeData.startY,
            endX: strokeData.endX,
            endY: strokeData.endY
        },
        timestamp: serverTimestamp()
    };
    
    push(strokesRef, stroke);
}

function redrawFromFirebase() {
    onValue(strokesRef, (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const stroke = childSnapshot.val();
            drawStroke(stroke);
        });
    }, { onlyOnce: true });
}

function drawStroke(stroke) {
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';

    switch (stroke.tool) {
        case 'pencil':
        case 'eraser':
            ctx.beginPath();
            ctx.moveTo(stroke.points.startX, stroke.points.startY);
            ctx.lineTo(stroke.points.endX, stroke.points.endY);
            ctx.stroke();
            break;
            
        case 'rectangle':
            ctx.beginPath();
            ctx.rect(
                stroke.points.startX,
                stroke.points.startY,
                stroke.points.endX - stroke.points.startX,
                stroke.points.endY - stroke.points.startY
            );
            ctx.stroke();
            break;
            
        case 'circle':
            const radius = Math.sqrt(
                Math.pow(stroke.points.endX - stroke.points.startX, 2) +
                Math.pow(stroke.points.endY - stroke.points.startY, 2)
            );
            ctx.beginPath();
            ctx.arc(stroke.points.startX, stroke.points.startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
            break;
    }
}

// Clear button
document.getElementById('clear').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the whiteboard?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        remove(strokesRef);
    }
});

// Save button
document.getElementById('save').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
});

// Mouse event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch event listeners
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
});

// Firebase connection status
const connectedRef = ref(database, '.info/connected');
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        status.textContent = 'Connected';
        status.style.backgroundColor = '#4CAF50';
    } else {
        status.textContent = 'Disconnected';
        status.style.backgroundColor = '#f44336';
    }
});

// Initial load
redrawFromFirebase();