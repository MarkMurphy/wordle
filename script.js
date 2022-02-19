import dictionary from "./scripts/dictionary.js";
import words from "./scripts/words.js";

/**
 * Trick to restart an element's animation
 *
 * @param {HTMLElement} element
 * @return void
 *
 * @see https://www.charistheo.io/blog/2021/02/restart-a-css-animation-with-javascript/#restarting-a-css-animation
 */
const reflow = (element) => {
  element.offsetHeight; // eslint-disable-line no-unused-expressions
};

const DANCE_ANIMATION_DURATION = 500;
const FLIP_ANIMATION_DURATION = 500;
const MODAL_CLASS_NAME_OPEN = "open";
const STATE_ACTIVE = "active";
const STATE_ABSENT = "absent";
const STATE_PRESENT = "present";
const STATE_CORRECT = "correct";
const START_DATE = new Date(2022, 0, 1);
const WORD_LENGTH = 5;
const GUESS_LIMIT = 6;
const WIN_MESSAGE = [
  "Genius",
  "Magnificent",
  "Impressive",
  "Splendid",
  "Great",
  "Phew",
];

const keyboard = document.querySelector("[data-keyboard]");
const grid = document.querySelector("[data-letter-grid]");
const tiles = Array.from(grid.children);
const alerts = document.querySelector("[data-alert-container]");
const gamesPlayed = document.querySelector("[data-statistic-games-played]");
const winPercentage = document.querySelector("[data-statistic-win-percentage]");
const currentStreak = document.querySelector("[data-statistic-current-streak]");
const bestStreak = document.querySelector("[data-statistic-best-streak]");

const GAME_STATUS_IN_PROGRESS = "IN_PROGRESS";
const GAME_STATUS_WIN = "WIN";
const GAME_STATUS_FAIL = "FAIL";
const STORAGE_STATE_KEY = "wordle-state";
const STORAGE_STATISTICS_KEY = "wordle-statistics";
const STORAGE_SETTINGS_KEY = "wordle-settings";

const STORAGE_STATE_DEFAULT = {
  boardState: null,
  evaluations: null,
  rowIndex: 0,
  solution: null,
  gameStatus: null,
  lastPlayedAt: null,
  lastCompletedAt: null,
};

const STORAGE_STATISTICS_DEFAULT = {
  currentStreak: 0,
  maxStreak: 0,
  guesses: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    fail: 0,
  },
  winPercentage: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  averageGuesses: 0,
};

const STORAGE_SETTINGS_DEFAULT = {
  disableAbsentLetters: false,
  darkmode: null,
  cbmode: null,
};

const storage = {
  state: {
    read() {
      try {
        const text = localStorage.getItem(STORAGE_STATE_KEY);
        const value = text ? JSON.parse(text) : STORAGE_STATE_DEFAULT;
        return value;
      } catch (error) {
        console.error(error);
        return STORAGE_STATE_DEFAULT;
      }
    },
    write(value) {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(value));
    },
  },
  stats: {
    read() {
      try {
        const text = localStorage.getItem(STORAGE_STATISTICS_KEY);
        const value = text ? JSON.parse(text) : STORAGE_STATISTICS_DEFAULT;
        // TODO: Assert value matches expected data structure
        return value;
      } catch (error) {
        console.error(error);
        return STORAGE_STATISTICS_DEFAULT;
      }
    },
    write(value) {
      localStorage.setItem(STORAGE_STATISTICS_KEY, JSON.stringify(value));
    },
  },
  settings: {
    read() {
      try {
        const text = localStorage.getItem(STORAGE_SETTINGS_KEY);
        const value = text ? JSON.parse(text) : STORAGE_SETTINGS_DEFAULT;
        // TODO: Assert value matches expected data structure
        return value;
      } catch (error) {
        console.error(error);
        return STORAGE_SETTINGS_DEFAULT;
      }
    },
    write(value) {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(value));
    },
  },
};

const root = document.documentElement;
const gameState = storage.state.read();
const settings = storage.settings.read();
const theme = window.matchMedia?.("(prefers-color-scheme: dark)");

function init() {
  applyTheme();
  applyColorBlindMode();

  const state = storage.state.read();
  const lastCompletedWordle = getWordleNumber(state.lastCompletedAt);

  switch (state.gameStatus) {
    case GAME_STATUS_IN_PROGRESS:
      resumeGame(state);
      break;
    case GAME_STATUS_FAIL:
      if (lastCompletedWordle === getWordleNumber(Date.now())) {
        resumeGame(state);
        break;
      }
    case GAME_STATUS_WIN:
      if (lastCompletedWordle === getWordleNumber(Date.now())) {
        resumeGame(state);
        break;
      }
    default:
      newGame();
      break;
  }

  applyDisabledLetterMode();
}

init();

function getWordleNumber(date) {
  return Math.floor((date - START_DATE) / 1000 / 60 / 60 / 24);
}

function newGame() {
  gtag("event", "new", {
    event_category: "Games",
  });
  const now = Date.now();
  const number = getWordleNumber(now);

  if (gameState === STORAGE_STATE_DEFAULT) {
    setTimeout(() => {
      openHelp();
    }, 1000);
  }

  Object.assign(gameState, {
    gameStatus: GAME_STATUS_IN_PROGRESS,
    lastPlayedAt: now,
    solution: words[number % words.length],
    rowIndex: 0,
    boardState: null,
    evaluations: null,
  });

  storage.state.write(gameState);

  startInteraction();
}

function resumeGame(gameState) {
  gtag("event", "resume", {
    event_category: "Games",
  });
  gameState.boardState?.forEach((guess, rowIndex) => {
    Array.from(guess).forEach((letter, letterIndex) => {
      const index = rowIndex * WORD_LENGTH + letterIndex;
      const tile = tiles[index];
      const state = gameState.evaluations[rowIndex][letterIndex];
      setTileState(tile, state, letter);
    });
  });

  if (gameState.gameStatus === GAME_STATUS_WIN) {
    openStatistics();
    return;
  }

  if (gameState.gameStatus === GAME_STATUS_FAIL) {
    openStatistics();
    return;
  }

  startInteraction();
}

function setDisabledLetterMode(value) {
  settings.disableAbsentLetters = value === null ? null : Boolean(value);
  applyDisabledLetterMode();
}

function applyDisabledLetterMode() {
  const keys = [...keyboard.querySelectorAll(`[data-state="${STATE_ABSENT}"]`)];
  keys.forEach((key) => {
    key.disabled = Boolean(settings.disableAbsentLetters);
  });
}

function setColorBlindMode(value) {
  settings.cbmode = value === null ? null : Boolean(value);
  applyColorBlindMode();
}

function applyColorBlindMode() {
  if (settings.cbmode) {
    root.setAttribute("data-cbmode", "");
  } else {
    root.removeAttribute("data-cbmode");
  }
}

function setDarkMode(value) {
  settings.darkmode = Boolean(value);
  root.dataset.theme = settings.darkmode ? "dark" : "light";
}

function applyTheme(media = theme) {
  const darkmode = Boolean(
    settings.darkmode === null ? media?.matches : settings.darkmode
  );
  root.dataset.theme = darkmode ? "dark" : "light";
}

theme.addEventListener("change", applyTheme);

const handleSettingChange = (event) => {
  const setting = event.target.dataset.setting;
  const value = event.target?.checked;

  if (setting == null) {
    return;
  }

  if (setting === "disableAbsentLetters") {
    setDisabledLetterMode(value);
  }

  if (setting === "darkmode") {
    setDarkMode(value);
  }

  if (setting === "cbmode") {
    setColorBlindMode(value);
  }

  gtag("event", "change", {
    event_category: "Settings",
    event_label: setting,
    value,
  });

  storage.settings.write(settings);
};

document.addEventListener("change", handleSettingChange);

const handleModalButton = (e) => {
  if (e.target.matches('[data-toggle="modal"]')) {
    openModal(e.target.dataset.target);
  }
};

document.addEventListener("click", handleModalButton);

const shareButton = document.querySelector("[data-share-button]");
shareButton.addEventListener("click", share);

async function share() {
  gtag("event", "share", {
    event_category: "Shares",
  });

  const text = getSharableText();

  if (navigator.share) {
    try {
      await navigator.share({
        title: document.title,
        text,
      });
      return;
    } catch (error) {
      // On AbortError, allow to fall through to clipboard method below
      if (error.name !== "AbortError") {
        console.error("Error sharing:", error);
        showAlert("Share failed");
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showAlert("Copied results to clipboard", 2000);
  } catch (error) {
    // NotAllowedError, code: 0
    console.error("Could not copy results to clipboard: ", error);
  }
}

function getSharableText() {
  const letters = [...grid.querySelectorAll("[data-letter]")];
  const guesses = letters.reduce((guesses, letter, index) => {
    const guess = Math.floor(index / WORD_LENGTH) % GUESS_LIMIT;

    if (guesses[guess] == null) {
      guesses[guess] = "";
    }

    guesses[guess] += getLetterStateEmoji(letter.dataset.state);

    return guesses;
  }, []);

  const text = [
    `Wordle ${getWordleNumber(gameState.lastPlayedAt)} ${
      guesses.length
    }/${GUESS_LIMIT}`,
    ``,
    ...guesses,
    ``,
  ].join("\n");

  return text;
}

function getLetterStateEmoji(state) {
  const { cbmode = false, darkmode = root.dataset.theme === "dark" } = settings;

  switch (state) {
    case STATE_CORRECT:
      return cbmode ? "🟧" : "🟩";
    case STATE_PRESENT:
      return cbmode ? "🟦" : "🟨";
    case STATE_ABSENT:
      return darkmode ? "⬛" : "⬜";
    default:
      return " ";
  }
}

function startInteraction() {
  document.addEventListener("click", handleMouseClick);
  document.addEventListener("keydown", handleKeyDown);
}

function stopInteraction() {
  document.removeEventListener("click", handleMouseClick);
  document.removeEventListener("keydown", handleKeyDown);
}

function handleMouseClick(e) {
  if (e.target.matches("[data-key]")) {
    const key = e.target.dataset.key;
    switch (key) {
      case "↵":
        submit();
        break;
      case "←":
        deleteKey();
        break;
      default:
        pressKey(key);
        break;
    }
  }
}

function openHelp() {
  openModal("#instructions");
}

function openSettings() {
  openModal("#settings");
}

function openStatistics() {
  openModal("#statistics");
}

function handleKeyDown(e) {
  if (e.key === "Enter") {
    submit();
    return;
  }

  if (e.key == "Backspace" || e.key === "Delete") {
    deleteKey();
    return;
  }

  if (e.key.match(/^[a-zA-Z]$/)) {
    pressKey(e.key);
  }
}

function pressKey(key) {
  if (
    settings.disableAbsentLetters &&
    keyboard.querySelector(`[data-key="${key}"i][data-state="${STATE_ABSENT}"]`)
  ) {
    return;
  }

  const activeTiles = getActiveTiles();
  if (activeTiles.length >= WORD_LENGTH) {
    return;
  }

  const nextTile = grid.querySelector(":not([data-letter])");
  nextTile.dataset.letter = key.toLowerCase();
  nextTile.dataset.state = STATE_ACTIVE;
  nextTile.textContent = key;
}

function submit() {
  const activeTiles = [...getActiveTiles()];
  if (activeTiles.length !== WORD_LENGTH) {
    showAlert("Not enough letters");
    shakeTiles(activeTiles);
    return;
  }

  const guess = activeTiles.reduce((word, tile) => {
    return word + tile.dataset.letter;
  }, "");

  if (!(words.includes(guess) || dictionary.includes(guess))) {
    showAlert("Not in word list");
    shakeTiles(activeTiles);
    return;
  }

  stopInteraction();

  const results = compare(guess, gameState.solution);

  const rowIndex =
    Math.floor(
      tiles.indexOf(activeTiles[activeTiles.length - 1]) / WORD_LENGTH
    ) % GUESS_LIMIT;

  gameState.rowIndex = rowIndex;
  gameState.boardState = [...(gameState.boardState ?? []), guess];
  gameState.evaluations = [...(gameState.evaluations ?? []), results];

  storage.state.write(gameState);

  activeTiles.forEach(flipTile.bind(null, guess, results));
}

function compare(guess, solution) {
  const results = Array(WORD_LENGTH).fill(STATE_ABSENT);
  const remaining = [...solution];

  Array.from(guess).forEach((letter, index) => {
    if (remaining[index] === letter) {
      delete remaining[index];
      results[index] = STATE_CORRECT;
    }
  });

  results.forEach((state, index) => {
    if (state === STATE_CORRECT) {
      return;
    }

    const letterIndex = remaining.indexOf(guess[index]);
    if (letterIndex >= 0) {
      delete remaining[letterIndex];
      results[index] = STATE_PRESENT;
    }
  });

  return results;
}

function deleteKey() {
  const activeTiles = getActiveTiles();
  const lastTile = activeTiles[activeTiles.length - 1];

  if (lastTile == null) {
    return;
  }

  lastTile.textContent = null;
  delete lastTile.dataset.state;
  delete lastTile.dataset.letter;
}

function getActiveTiles() {
  return grid.querySelectorAll('[data-state="active"]');
}

function setTileState(tile, state, letter = undefined) {
  if (letter) {
    tile.dataset.letter = letter;
    tile.textContent = letter;
  } else {
    letter = tile.dataset.letter;
  }

  const key = keyboard.querySelector(`[data-key="${letter}"i]`);

  tile.dataset.state = state;

  if (state === STATE_CORRECT) {
    key.dataset.state = state;
  }

  if (key.dataset.state == null) {
    key.dataset.state = state;
  }

  if (key.dataset.state === STATE_ABSENT && settings.disableAbsentLetters) {
    key.disabled = true;
  }
}

function flipTile(guess, results, tile, index, tiles) {
  setTimeout(
    () => tile.classList.add("flip"),
    (index * FLIP_ANIMATION_DURATION) / 2
  );

  tile.addEventListener(
    "transitionend",
    () => {
      tile.classList.remove("flip");

      const state = results[index];
      setTileState(tile, state);

      if (index === tiles.length - 1) {
        tile.addEventListener(
          "transitionend",
          () => {
            startInteraction();
            checkWinLose(guess, tiles);
          },
          { once: true }
        );
      }
    },
    { once: true }
  );
}

function showAlert(message, duration = 1000) {
  const alert = document.createElement("div");
  alert.textContent = message;
  alert.classList.add("alert");
  alerts.prepend(alert);
  if (duration == null) {
    return;
  }
  setTimeout(() => {
    alert.classList.add("hide");
    alert.addEventListener(
      "transitionend",
      () => {
        alert.remove();
      },
      { once: true }
    );
  }, duration);
}

function handleBeforeModalOpen(selector) {
  if (selector === "#statistics") {
    renderStatistics();
  }

  if (selector === "#settings") {
    renderSettings();
  }
}

function openModal(selector) {
  const modal = document.querySelector(selector);
  const backdrop = modal.querySelector("[data-modal-backdrop]");
  const body = modal.querySelector("[data-modal-body]");
  const dismiss = modal.querySelector('[data-dismiss="modal"]');

  if (handleBeforeModalOpen(selector) === false) {
    return;
  }

  modal.style.display = "block";
  modal.removeAttribute("aria-hidden");
  modal.setAttribute("aria-modal", true);
  modal.setAttribute("role", "dialog");
  modal.scrollTop = 0;

  if (body) {
    body.scrollTop = 0;
  }

  reflow(modal);

  modal.classList.add(MODAL_CLASS_NAME_OPEN);

  const close = () => {
    backdrop.removeEventListener("click", handleDismiss);
    dismiss?.removeEventListener("click", handleDismiss);
    document.removeEventListener("keydown", handleEscape);
    const handleTransitonEnd = () => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", true);
      modal.removeAttribute("aria-modal");
      modal.removeAttribute("role");
    };
    modal.addEventListener("transitionend", handleTransitonEnd, {
      once: true,
    });
    modal.classList.remove(MODAL_CLASS_NAME_OPEN);
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  const handleDismiss = (event) => {
    close();
  };

  backdrop.addEventListener("click", handleDismiss, { once: true });
  dismiss?.addEventListener("click", handleDismiss, { once: true });
  document.addEventListener("keydown", handleEscape);
}

function shakeTiles(tiles) {
  tiles.forEach((tile) => {
    tile.classList.add("shake");
    tile.addEventListener(
      "animationend",
      () => {
        tile.classList.remove("shake");
      },
      { once: true }
    );
  });
}

function danceTiles(tiles) {
  return new Promise((resolve) => {
    tiles.forEach((tile, index) => {
      setTimeout(() => {
        tile.classList.add("dance");
        tile.addEventListener(
          "animationend",
          () => {
            tile.classList.remove("dance");
            resolve();
          },
          { once: true }
        );
      }, (index * DANCE_ANIMATION_DURATION) / 5);
    });
  });
}

function checkWinLose(guess, tiles) {
  if (guess === gameState.solution) {
    return win(tiles, true);
  }

  const remainingTiles = grid.querySelectorAll(":not([data-letter])");
  if (remainingTiles.length === 0) {
    return fail(tiles, true);
  }
}

function win(tiles) {
  stopInteraction();
  gameState.gameStatus = GAME_STATUS_WIN;
  gameState.lastCompletedAt = Date.now();
  storage.state.write(gameState);
  updateStats({
    guessCount: getGuessCount(),
    isWin: true,
  });
  const message = WIN_MESSAGE[Math.floor(Math.random() * WIN_MESSAGE.length)];
  showAlert(message, 3000);
  danceTiles(tiles).then(() => setTimeout(openStatistics, 3000));
  gtag("event", "win", {
    event_category: "Games",
    event_label: gameState.solution,
    value: getGuessCount(),
  });
}

function fail(tiles) {
  stopInteraction();
  gameState.gameStatus = GAME_STATUS_FAIL;
  gameState.lastCompletedAt = Date.now();
  storage.state.write(gameState);
  updateStats({
    guessCount: getGuessCount(),
    isWin: false,
  });
  showAlert(gameState.solution.toUpperCase(), null);
  setTimeout(openStatistics, 3000);
  gtag("event", "lose", {
    event_category: "Games",
    event_label: gameState.solution,
  });
}

function getGuessCount() {
  return gameState.rowIndex + 1;
}

function updateStats({ guessCount, isWin }) {
  const stats = storage.stats.read();

  stats.gamesPlayed += 1;
  stats.gamesWon += isWin ? 1 : 0;
  stats.winPercentage = Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
  stats.guesses[guessCount] += 1;
  stats.guesses.fail += isWin ? 0 : 1;
  stats.averageGuesses = computeAverageGuesses(stats.guesses, stats.gamesWon);
  stats.currentStreak = isWin ? stats.currentStreak + 1 : 0;
  stats.maxStreak = Math.max(stats.currentStreak, stats.maxStreak);

  storage.stats.write(stats);
}

function renderStatistics() {
  const stats = storage.stats.read();

  gamesPlayed.textContent = stats.gamesPlayed;
  winPercentage.textContent = stats.winPercentage;
  currentStreak.textContent = stats.currentStreak;
  bestStreak.textContent = stats.maxStreak;

  const element = document.querySelector("[data-distribution]");
  const distributon = computeGuessDistributon();

  if (distributon == null) {
    element.textContent = "No Data";
    return;
  }

  const container = document.createElement("div");
  container.classList.add("graph-container");

  Object.entries(distributon).forEach(([number, value], index) => {
    const guess = document.createElement("div");
    guess.classList.add("guess");
    guess.textContent = number;

    const graph = document.createElement("div");
    graph.classList.add("graph");

    const count = document.createElement("div");
    count.classList.add("count");
    count.textContent = value.count;

    setTimeout(() => {
      count.style.width = value.width + "%";
    }, index * 50);

    // highlight is true if the current game has ended, it highlights the guess number taken this game
    if (value.highlight) {
      count.classList.add("highlight");
    }

    graph.append(count);
    container.append(guess, graph);
  });

  element.replaceChildren(container);
}

function renderSettings() {
  for (const name of Object.keys(settings)) {
    const element = document.querySelector(`[data-setting="${name}"]`);
    if (element instanceof HTMLInputElement) {
      element.checked = Boolean(settings[name]);
    }
  }
}

function computeGuessDistributon() {
  const stats = storage.stats.read();
  const counts = Object.values(stats.guesses);
  if (counts.every((count) => count === 0)) {
    return null;
  }

  const max = Math.max(...counts);
  const length = counts.length;

  const distribution = {};
  for (let guess = 1; guess < length; guess++) {
    const count = stats.guesses[guess];
    const width = Math.round((count / max) * 100);
    distribution[guess] = {
      count,
      width,
      highlight:
        gameState.gameStatus !== GAME_STATUS_FAIL &&
        guess === gameState.rowIndex + 1,
    };
  }

  return distribution;
}

function computeAverageGuesses(guesses, gamesWon) {
  return Math.round(
    Object.entries(guesses).reduce((sum, [key, value]) => {
      return key !== "fail" ? (sum += key * value) : sum;
    }, 0) / gamesWon
  );
}
