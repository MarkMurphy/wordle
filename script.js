import dictionary from "./dictionary.js";
import words from "./words.js";

startInteraction();

const WORD_LENGTH = 5;
const FLIP_ANIMATION_DURATION = 500;
const DANCE_ANIMATION_DURATION = 500;

const STATE_ACTIVE = "active";
const STATE_ABSENT = "absent";
const STATE_PRESENT = "present";
const STATE_CORRECT = "correct";

const help = document.querySelector('[data-modal="help"]');
const keyboard = document.querySelector("[data-keyboard]");
const grid = document.querySelector("[data-letter-grid]");
const alerts = document.querySelector("[data-alert-container]");
const word = getWordOfTheDay();

function getWordOfTheDay(offsetFromDate = new Date(2022, 0, 1)) {
  const msOffset = Date.now() - offsetFromDate;
  const dayOffset = Math.floor(msOffset / 1000 / 60 / 60 / 24);
  return words[dayOffset % words.length];
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

  if (e.target.matches("[data-help]")) {
    openModal("help");
  }
}

function openModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (modal == null) {
    return;
  }
  modal.classList.add("open");
  modal.querySelector("[data-close]").addEventListener(
    "click",
    () => {
      closeModal(name);
    },
    { once: true }
  );
}

function closeModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (modal == null) {
    return;
  }
  modal.classList.remove("open");
  modal.classList.add("close");
  modal.addEventListener(
    "transitionend",
    () => {
      modal.classList.remove("close");
    },
    { once: true }
  );
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

  if (e.key == "Escape") {
    const modal = document.querySelector("[data-modal].open");
    if (modal) {
      closeModal(modal.dataset.modal);
    }
    return;
  }

  if (e.key.match(/^[a-zA-Z]$/)) {
    pressKey(e.key);
  }
}

function pressKey(key) {
  const activeTiles = getActiveTitles();
  if (activeTiles.length >= WORD_LENGTH) {
    return;
  }

  const nextTile = grid.querySelector(":not([data-letter])");
  nextTile.dataset.letter = key;
  nextTile.dataset.state = STATE_ACTIVE;
  nextTile.textContent = key;
}

function submit() {
  const activeTiles = [...getActiveTitles()];
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

  activeTiles.forEach((...args) => {
    flipTile(...args, guess);
  });
}

function deleteKey() {
  const activeTiles = getActiveTitles();
  const lastTile = activeTiles[activeTiles.length - 1];

  if (lastTile == null) {
    return;
  }

  lastTile.textContent = null;
  delete lastTile.dataset.state;
  delete lastTile.dataset.letter;
}

function getActiveTitles() {
  return grid.querySelectorAll('[data-state="active"]');
}

function flipTile(tile, index, array, guess) {
  const letter = tile.dataset.letter;
  const key = keyboard.querySelector(`[data-key="${letter}"i]`);
  setTimeout(() => {
    tile.classList.add("flip");
  }, (index * FLIP_ANIMATION_DURATION) / 2);

  tile.addEventListener(
    "transitionend",
    () => {
      tile.classList.remove("flip");
      if (word[index] === letter) {
        tile.dataset.state = STATE_CORRECT;
        key.dataset.state = STATE_CORRECT;
      } else if (word.includes(letter)) {
        tile.dataset.state = STATE_PRESENT;
        key.dataset.state = STATE_PRESENT;
      } else {
        tile.dataset.state = STATE_ABSENT;
        key.dataset.state = STATE_ABSENT;
        key.disabled = true;
      }

      if (index === array.length - 1) {
        tile.addEventListener(
          "transitionend",
          () => {
            startInteraction();
            checkWinLose(guess, array);
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
  tiles.forEach((tile, index) => {
    setTimeout(() => {
      tile.classList.add("dance");
      tile.addEventListener(
        "animationend",
        () => {
          tile.classList.remove("dance");
        },
        { once: true }
      );
    }, (index * DANCE_ANIMATION_DURATION) / 5);
  });
}

function checkWinLose(guess, tiles) {
  if (guess === word) {
    stopInteraction();
    showAlert("You Win", 5000);
    danceTiles(tiles);
    return;
  }

  const remainingTiles = grid.querySelectorAll(":not([data-letter])");
  if (remainingTiles.length === 0) {
    stopInteraction();
    showAlert(word.toUpperCase(), null);
  }
}
