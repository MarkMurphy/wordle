import dictionary from "./scripts/dictionary.js";
import words from "./scripts/words.js";

const DANCE_ANIMATION_DURATION = 500;
const FLIP_ANIMATION_DURATION = 500;
const MODAL_CLASS_NAME_OPEN = "open";
const STATE_ACTIVE = "active";
const STATE_ABSENT = "absent";
const STATE_PRESENT = "present";
const STATE_CORRECT = "correct";

const keyboard = document.querySelector("[data-keyboard]");
const grid = document.querySelector("[data-letter-grid]");
const alerts = document.querySelector("[data-alert-container]");

const WORD_LENGTH = 5;
const START_DATE = new Date(2022, 0, 1);
const wordle = Math.floor((Date.now() - START_DATE) / 1000 / 60 / 60 / 24);
const word = words[wordle % words.length];

const root = document.documentElement;
const theme = window.matchMedia?.("(prefers-color-scheme: light)") || {};

changeTheme(theme);
startInteraction();

function changeTheme({ matches }) {
  root.dataset.theme = matches ? "light" : "dark";
}

theme.addEventListener("change", changeTheme);

const settings = {
  disableAbsentLetters: false,
};

const handleSettingChange = (event) => {
  const setting = e.target.dataset.setting;

  if (setting == null) {
    return;
  }

  if (setting === "disableAbsentLetters") {
    settings.disableAbsentLetters = Boolean(e.target.checked);
  }
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

function openModal(selector) {
  const modal = document.querySelector(selector);
  const backdrop = modal.querySelector("[data-modal-backdrop]");
  const body = modal.querySelector("[data-modal-body]");
  const dismiss = modal.querySelector('[data-dismiss="modal"]');

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

/**
 * Trick to restart an element's animation
 *
 * @param {HTMLElement} element
 * @return void
 *
 * @see https://www.charistheo.io/blog/2021/02/restart-a-css-animation-with-javascript/#restarting-a-css-animation
 */
export const reflow = (element) => {
  element.offsetHeight; // eslint-disable-line no-unused-expressions
};
