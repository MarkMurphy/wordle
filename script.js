import dictionary from "./scripts/dictionary.js";
import words from "./scripts/words.js";

const root = document.documentElement;
const theme = window.matchMedia?.("(prefers-color-scheme: light)") || {};

changeTheme(theme);

function changeTheme({ matches }) {
  root.dataset.theme = matches ? "light" : "dark";
}

theme.addEventListener("change", changeTheme);

startInteraction();

const WORD_LENGTH = 5;
const FLIP_ANIMATION_DURATION = 500;
const DANCE_ANIMATION_DURATION = 500;

const STATE_ACTIVE = "active";
const STATE_ABSENT = "absent";
const STATE_PRESENT = "present";
const STATE_CORRECT = "correct";

const helpButton = document.querySelector("[data-help-button]");
const statisticsButton = document.querySelector("[data-statistics-button]");
const settingsButton = document.querySelector("[data-settings-button]");
const shareButton = document.querySelector("[data-share-button]");

const keyboard = document.querySelector("[data-keyboard]");
const grid = document.querySelector("[data-letter-grid]");
const alerts = document.querySelector("[data-alert-container]");

const START_DATE = new Date(2022, 0, 1);
const wordle = Math.floor((Date.now() - START_DATE) / 1000 / 60 / 60 / 24);
const word = words[wordle % words.length];

const settings = {
  disableAbsentLetters: false,
};

document.addEventListener("change", (e) => {
  const setting = e.target.dataset.setting;

  if (setting == null) {
    return;
  }

  if (setting === "disableAbsentLetters") {
    settings.disableAbsentLetters = Boolean(e.target.checked);
  }
});

helpButton.addEventListener("click", openHelp);
statisticsButton.addEventListener("click", openStatistics);
settingsButton.addEventListener("click", openSettings);

shareButton.addEventListener("click", share);

async function share() {
  const text = getSharableText();

  if (navigator.share) {
    try {
      await navigator.share({
        title: document.title,
        text,
      });
      return;
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    showAlert("Copied results to clipboard", 2000);
  } catch (error) {
    console.error("Could not copy results to clipboard: ", error);
  }
}

function getSharableText() {
  const letters = [...grid.querySelectorAll("[data-letter]")];
  const guesses = letters.reduce((guesses, letter, index) => {
    const guess = Math.floor(index / WORD_LENGTH) % 6;

    if (guesses[guess] == null) {
      guesses[guess] = "";
    }

    guesses[guess] += getLetterStateEmoji(letter.dataset.state);

    return guesses;
  }, []);

  const text = [`Wordle ${wordle} ${guesses.length}/6`, ``, ...guesses].join(
    "\n"
  );

  return text;
}

function getLetterStateEmoji(state) {
  switch (state) {
    case STATE_ABSENT:
      return "⬜";
    case STATE_PRESENT:
      return "🟨";
    case STATE_CORRECT:
      return "🟩";
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

function openModal(name) {
  const modal = document.querySelector(`[data-modal="${name}"]`);
  if (modal == null) {
    return;
  }

  // close any currently open modals
  document.querySelectorAll(`[data-modal].open`).forEach(closeModal);

  const close = modal.querySelector("[data-close]");
  const overlay = modal.querySelector("[data-overlay]");
  const handleModalClose = (e) => {
    if (e instanceof KeyboardEvent && e.key === "Escape") {
      close.removeEventListener("clink", handleModalClose);
      closeModal(name);
    }

    if (e instanceof MouseEvent) {
      overlay.removeEventListener("click", handleModalClose);
      document.removeEventListener("keydown", handleModalClose);
      closeModal(name);
    }
  };

  close.addEventListener("click", handleModalClose, { once: true });
  overlay.addEventListener("click", handleModalClose, { once: true });
  document.addEventListener("keydown", handleModalClose, { once: true });

  modal.classList.add("open");
}

function closeModal(modal) {
  if (typeof modal === "string") {
    modal = document.querySelector(`[data-modal="${modal}"]`);
  }

  if (modal == null) {
    return;
  }

  modal.classList.remove("open");
  modal.classList.add("closing");
  modal.addEventListener(
    "animationend",
    () => {
      modal.classList.remove("closing");
    },
    { once: true }
  );
}

function openSettings() {
  openModal("settings");
}

function openStatistics() {
  openModal("statistics");
}

function openHelp() {
  openModal("help");
}

function openStatistics() {
  openModal("statistics");
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

  const activeTiles = getActiveTitles();
  if (activeTiles.length >= WORD_LENGTH) {
    return;
  }

  const nextTile = grid.querySelector(":not([data-letter])");
  nextTile.dataset.letter = key.toLowerCase();
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
        if (settings.disableAbsentLetters) {
          key.disabled = true;
        }
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
  if (guess === word) {
    stopInteraction();
    showAlert("You Win!", 5000);
    danceTiles(tiles).then(() => setTimeout(openStatistics, 1000));
    return;
  }

  const remainingTiles = grid.querySelectorAll(":not([data-letter])");
  if (remainingTiles.length === 0) {
    stopInteraction();
    showAlert(word.toUpperCase(), null);
    showStats();
  }
}
