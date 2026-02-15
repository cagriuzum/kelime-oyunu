// Game Mode Configurations
const GAME_MODES = {
    klasik: {
        name: 'Klasik',
        rounds: 5,
        timeLimit: null,  // No time limit
        description: '5 tur, süre sınırı yok'
    },
    zamanlı: {
        name: 'Zamanlı',
        rounds: 5,
        timeLimit: 15,  // Default 15 seconds per turn (user can customize)
        description: '5 tur, kullanıcı belirli süre'
    }
};

// Game state
const gameState = {
    currentMode: 'klasik',
    currentPlayer: 1,
    round: 1,
    lastLetter: null,
    wordHistory: [],
    turnsInRound: 0,
    gameOver: false,
    timerInterval: null,
    timeRemaining: 0,
    customTimeLimit: 15  // User-defined time limit for zamanlı mode
};

// DOM elements
const roundDisplay = document.getElementById('round');
const maxRoundsDisplay = document.getElementById('max-rounds');
const currentPlayerDisplay = document.getElementById('current-player');
const instructionText = document.getElementById('instruction-text');
const requiredLetter = document.getElementById('required-letter');
const wordInput = document.getElementById('word-input');
const submitBtn = document.getElementById('submit-btn');
const messageDiv = document.getElementById('message');
const spellingNoteDiv = document.getElementById('spelling-note');
const wordHistoryList = document.getElementById('word-history');
const gameOverScreen = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');
const timerDiv = document.getElementById('timer');
const timeLeftDisplay = document.getElementById('time-left');
const modeTabs = document.querySelectorAll('.mode-tab');
const timeLimitModal = document.getElementById('time-limit-modal');
const timeLimitInput = document.getElementById('time-limit-input');
const timeLimitConfirmBtn = document.getElementById('time-limit-confirm');

// Initialize game
function init() {
    updateDisplay();
    wordInput.focus();

    submitBtn.addEventListener('click', handleSubmit);
    wordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });
    restartBtn.addEventListener('click', restartGame);

    // Mode tab listeners
    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const mode = tab.dataset.mode;
            if (mode !== gameState.currentMode) {
                switchMode(mode);
            }
        });
    });

    // Time limit modal listeners
    timeLimitConfirmBtn.addEventListener('click', confirmTimeLimit);
    timeLimitInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmTimeLimit();
        }
    });
}

// Switch game mode
function switchMode(mode) {
    if (!GAME_MODES[mode]) return;

    gameState.currentMode = mode;

    // Update tab UI
    modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Show time limit modal for zamanlı mode
    if (mode === 'zamanlı') {
        showTimeLimitModal();
    } else {
        // Restart game with new mode
        restartGame();
    }
}

// Show time limit input modal
function showTimeLimitModal() {
    timeLimitInput.value = gameState.customTimeLimit;
    timeLimitModal.classList.remove('hidden');
    timeLimitInput.focus();
    timeLimitInput.select();
}

// Confirm time limit and start game
function confirmTimeLimit() {
    const value = parseInt(timeLimitInput.value, 10);
    if (value && value > 0 && value <= 120) {
        gameState.customTimeLimit = value;
    } else {
        gameState.customTimeLimit = 15; // Default if invalid
    }
    timeLimitModal.classList.add('hidden');
    startNewGame();
}

// Get current mode config
function getCurrentModeConfig() {
    return GAME_MODES[gameState.currentMode];
}

// Find the correct Turkish spelling of a word
function findCorrectSpelling(inputWord) {
    const normalized = inputWord.toLowerCase().trim();

    // If word exists directly, return it
    if (TURKISH_WORDS.has(normalized)) {
        return normalized;
    }

    // Try to find the matching word with Turkish characters
    return findMatchingWord(normalized, 0, '');
}

function findMatchingWord(word, index, builtWord) {
    if (index >= word.length) {
        if (TURKISH_WORDS.has(builtWord)) {
            return builtWord;
        }
        return null;
    }

    const char = word[index];
    const equivalents = CHAR_EQUIVALENTS[char] || [char];

    for (const eq of equivalents) {
        const result = findMatchingWord(word, index + 1, builtWord + eq);
        if (result) {
            return result;
        }
    }

    return null;
}

// Check if the input differs from the correct spelling
function hasSpellingDifference(input, correct) {
    return input.toLowerCase() !== correct.toLowerCase();
}

// Timer functions
function startTimer() {
    const config = getCurrentModeConfig();
    if (!config.timeLimit) return;

    stopTimer();
    // Use custom time limit for zamanlı mode
    gameState.timeRemaining = gameState.currentMode === 'zamanlı'
        ? gameState.customTimeLimit
        : config.timeLimit;
    updateTimerDisplay();
    timerDiv.classList.remove('hidden');

    gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();

        if (gameState.timeRemaining <= 5) {
            timerDiv.classList.add('warning');
        }

        if (gameState.timeRemaining <= 0) {
            handleTimeUp();
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    timerDiv.classList.remove('warning');
}

function updateTimerDisplay() {
    timeLeftDisplay.textContent = gameState.timeRemaining;
}

function handleTimeUp() {
    stopTimer();
    showMessage(`Süre doldu! Oyuncu ${gameState.currentPlayer} kaybetti.`, 'error');

    // End the game when time runs out
    setTimeout(() => {
        endGame(`Oyuncu ${gameState.currentPlayer} süreyi aştı!`);
    }, 1500);
}

// Handle word submission
function handleSubmit() {
    if (gameState.gameOver) return;

    const word = wordInput.value.trim().toLowerCase();
    spellingNoteDiv.innerHTML = '';

    if (!word) {
        showMessage('Lütfen bir kelime girin.', 'error');
        return;
    }

    // Check if word starts with required letter (if not first turn)
    if (gameState.lastLetter) {
        const firstChar = word[0];
        if (!charactersMatch(gameState.lastLetter, firstChar)) {
            showMessage(`Kelime "${gameState.lastLetter.toUpperCase()}" harfi ile başlamalı!`, 'error');
            wordInput.select();
            return;
        }
    }

    // Check if word is valid Turkish word
    if (!isValidTurkishWord(word)) {
        showMessage('Bu kelime sözlükte bulunamadı. Başka bir kelime deneyin.', 'error');
        wordInput.select();
        return;
    }

    // Find the correct spelling
    const correctSpelling = findCorrectSpelling(word);

    // Check if word was already used (check both input and correct spelling)
    const wordToCheck = correctSpelling || word;
    if (gameState.wordHistory.some(entry => entry.word.toLowerCase() === wordToCheck)) {
        showMessage('Bu kelime daha önce kullanıldı!', 'error');
        wordInput.select();
        return;
    }

    // Valid word - stop timer and add to history
    stopTimer();
    addWordToHistory(correctSpelling || word);

    // Show spelling note if different
    if (correctSpelling && hasSpellingDifference(word, correctSpelling)) {
        spellingNoteDiv.innerHTML = `Doğru yazılışı: <span class="correct-spelling">${correctSpelling}</span>`;
    }

    // Update game state (use correct spelling for last letter)
    const finalWord = correctSpelling || word;
    gameState.lastLetter = finalWord[finalWord.length - 1];
    gameState.turnsInRound++;

    const config = getCurrentModeConfig();

    // Check if round is complete (both players played)
    if (gameState.turnsInRound >= 2) {
        gameState.round++;
        gameState.turnsInRound = 0;

        // Check if game is complete
        if (gameState.round > config.rounds) {
            endGame('Tebrikler! Oyunu başarıyla tamamladınız!');
            return;
        }
    }

    // Switch player
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;

    // Clear input and update display
    wordInput.value = '';
    showMessage('Doğru!', 'success');
    updateDisplay();
    wordInput.focus();

    // Start timer for next turn if timed mode
    startTimer();
}

// Add word to history display
function addWordToHistory(word) {
    gameState.wordHistory.push({
        word: word,
        player: gameState.currentPlayer
    });

    const li = document.createElement('li');
    li.className = `player-${gameState.currentPlayer}`;
    li.innerHTML = `
        <span class="word">${word}</span>
        <span class="player">Oyuncu ${gameState.currentPlayer}</span>
    `;

    // Add to top of list
    if (wordHistoryList.firstChild) {
        wordHistoryList.insertBefore(li, wordHistoryList.firstChild);
    } else {
        wordHistoryList.appendChild(li);
    }
}

// Update display
function updateDisplay() {
    const config = getCurrentModeConfig();

    roundDisplay.textContent = Math.min(gameState.round, config.rounds);
    maxRoundsDisplay.textContent = config.rounds;
    currentPlayerDisplay.textContent = `Oyuncu ${gameState.currentPlayer}`;

    // Show/hide timer based on mode
    if (config.timeLimit) {
        timerDiv.classList.remove('hidden');
    } else {
        timerDiv.classList.add('hidden');
    }

    if (gameState.lastLetter) {
        instructionText.textContent = 'Şu harfle başlayan bir kelime girin:';
        requiredLetter.textContent = gameState.lastLetter.toUpperCase();
        requiredLetter.style.display = 'inline-block';
    } else {
        instructionText.textContent = 'Bir kelime girin';
        requiredLetter.style.display = 'none';
    }

    // Update player indicator color
    document.querySelector('.game-area').className =
        `game-area ${gameState.currentPlayer === 2 ? 'player-2' : ''}`;
}

// Show message
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 1500);
    }
}

// End game
function endGame(message) {
    stopTimer();
    gameState.gameOver = true;

    // Update game over message
    const gameOverMessage = gameOverScreen.querySelector('p');
    if (gameOverMessage) {
        gameOverMessage.textContent = message || 'Oyun bitti!';
    }

    gameOverScreen.classList.remove('hidden');
}

// Restart game (may show time limit modal for zamanlı mode)
function restartGame() {
    // Show time limit modal for zamanlı mode
    if (gameState.currentMode === 'zamanlı') {
        showTimeLimitModal();
    } else {
        startNewGame();
    }
}

// Internal restart (after time limit is set)
function startNewGame() {
    stopTimer();

    gameState.currentPlayer = 1;
    gameState.round = 1;
    gameState.lastLetter = null;
    gameState.wordHistory = [];
    gameState.turnsInRound = 0;
    gameState.gameOver = false;

    wordHistoryList.innerHTML = '';
    gameOverScreen.classList.add('hidden');
    messageDiv.textContent = '';
    messageDiv.className = 'message';
    spellingNoteDiv.innerHTML = '';
    wordInput.value = '';

    updateDisplay();
    wordInput.focus();

    // Start timer if timed mode
    startTimer();
}

// Start the game
init();
