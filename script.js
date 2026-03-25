const BOARD_SIZE = 5;
const TURN_COUNT = BOARD_SIZE * BOARD_SIZE;
const MIN_VALUE = 1;
const MAX_VALUE = 10;

const boardEl = document.querySelector("#board");
const currentNumberEl = document.querySelector("#current-number");
const turnCaptionEl = document.querySelector("#turn-caption");
const filledCountEl = document.querySelector("#filled-count");
const scoreTotalEl = document.querySelector("#score-total");
const bestClusterEl = document.querySelector("#best-cluster");
const callsRemainingEl = document.querySelector("#calls-remaining");
const scoringSummaryEl = document.querySelector("#scoring-summary");
const sequenceStripEl = document.querySelector("#sequence-strip");
const sequenceInputEl = document.querySelector("#sequence-input");
const messageEl = document.querySelector("#message");
const newGameBtn = document.querySelector("#new-game-btn");
const undoBtn = document.querySelector("#undo-btn");
const resetBtn = document.querySelector("#reset-btn");
const loadSequenceBtn = document.querySelector("#load-sequence-btn");

const state = {
  board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)),
  sequence: [],
  turnIndex: 0,
  history: [],
};

function randomValue() {
  return Math.floor(Math.random() * MAX_VALUE) + MIN_VALUE;
}

function buildRandomSequence() {
  return Array.from({ length: TURN_COUNT }, randomValue);
}

function resetBoard(sequence = buildRandomSequence(), message = "New game ready.") {
  state.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  state.sequence = sequence.slice(0, TURN_COUNT);
  state.turnIndex = 0;
  state.history = [];
  sequenceInputEl.value = state.sequence.join(", ");
  setMessage(message);
  render();
}

function setMessage(message) {
  messageEl.textContent = message;
}

function parseSequence(rawText) {
  const parts = rawText
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== TURN_COUNT) {
    throw new Error(`Please enter exactly ${TURN_COUNT} numbers.`);
  }

  const sequence = parts.map((part) => {
    const value = Number(part);
    if (!Number.isInteger(value) || value < MIN_VALUE || value > MAX_VALUE) {
      throw new Error("Every value must be a whole number from 1 to 10.");
    }
    return value;
  });

  return sequence;
}

function placeCurrentNumber(row, col) {
  const currentNumber = state.sequence[state.turnIndex];
  if (currentNumber == null || state.board[row][col] != null) {
    return;
  }

  state.board[row][col] = currentNumber;
  state.history.push({ row, col, value: currentNumber });
  state.turnIndex += 1;
  setMessage(
    state.turnIndex === TURN_COUNT
      ? "Board complete. Final score locked in."
      : `Placed ${currentNumber}. Choose a square for the next call.`
  );
  render();
}

function undoMove() {
  const lastMove = state.history.pop();
  if (!lastMove) {
    return;
  }

  state.board[lastMove.row][lastMove.col] = null;
  state.turnIndex -= 1;
  setMessage(`Removed ${lastMove.value} from row ${lastMove.row + 1}, column ${lastMove.col + 1}.`);
  render();
}

function collectLineGroups(lineValues, fixedIndex, axis) {
  const groups = [];
  let start = 0;

  while (start < lineValues.length) {
    const value = lineValues[start];
    if (value == null) {
      start += 1;
      continue;
    }

    let end = start + 1;
    while (end < lineValues.length && lineValues[end] === value) {
      end += 1;
    }

    const length = end - start;
    if (length >= 2) {
      const cells = [];
      for (let index = start; index < end; index += 1) {
        cells.push(axis === "row" ? [fixedIndex, index] : [index, fixedIndex]);
      }
      groups.push({
        axis,
        value,
        length,
        score: value * length,
        cells,
      });
    }

    start = end;
  }

  return groups;
}

function computeScoring() {
  const groups = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    groups.push(...collectLineGroups(state.board[row], row, "row"));
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const columnValues = state.board.map((row) => row[col]);
    groups.push(...collectLineGroups(columnValues, col, "col"));
  }

  const cellFlags = new Map();
  for (const group of groups) {
    for (const [row, col] of group.cells) {
      const key = `${row}-${col}`;
      const entry = cellFlags.get(key) ?? { row: false, col: false };
      entry[group.axis] = true;
      cellFlags.set(key, entry);
    }
  }

  return {
    groups,
    totalScore: groups.reduce((sum, group) => sum + group.score, 0),
    longestGroup: groups.reduce((best, group) => Math.max(best, group.length), 0),
    cellFlags,
  };
}

function renderBoard(scoring) {
  boardEl.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      const value = state.board[row][col];
      const isFilled = value != null;
      const cellState = scoring.cellFlags.get(`${row}-${col}`);

      if (isFilled) {
        button.textContent = String(value);
        button.classList.add("cell-filled");
      } else {
        button.textContent = "";
        button.setAttribute("aria-label", `Empty row ${row + 1} column ${col + 1}`);
      }

      if (cellState?.row && cellState?.col) {
        button.classList.add("cell-both-score");
      } else if (cellState?.row) {
        button.classList.add("cell-row-score");
      } else if (cellState?.col) {
        button.classList.add("cell-col-score");
      }

      button.disabled = isFilled || state.turnIndex >= TURN_COUNT;
      button.addEventListener("click", () => placeCurrentNumber(row, col));
      boardEl.appendChild(button);
    }
  }
}

function renderSequence() {
  sequenceStripEl.innerHTML = "";
  state.sequence.forEach((value, index) => {
    const chip = document.createElement("div");
    chip.className = "sequence-chip";
    chip.textContent = String(value);
    if (index < state.turnIndex) {
      chip.classList.add("done");
    } else if (index === state.turnIndex) {
      chip.classList.add("current");
    }
    sequenceStripEl.appendChild(chip);
  });
}

function renderSummary(scoring) {
  scoringSummaryEl.innerHTML = "";

  if (scoring.groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "summary-line";
    empty.textContent = "No scoring groups yet. You need at least two matching neighbors in a row or column.";
    scoringSummaryEl.appendChild(empty);
    return;
  }

  scoring.groups.forEach((group, index) => {
    const line = document.createElement("div");
    line.className = "summary-line";
    const orientation = group.axis === "row" ? "Row" : "Column";
    const anchor = group.axis === "row" ? group.cells[0][0] + 1 : group.cells[0][1] + 1;
    line.textContent = `${index + 1}. ${orientation} ${anchor}: ${group.length} matching ${group.value}s = ${group.score} points.`;
    scoringSummaryEl.appendChild(line);
  });
}

function render() {
  const scoring = computeScoring();
  const filledCount = state.history.length;
  const remaining = TURN_COUNT - state.turnIndex;
  const currentNumber = state.sequence[state.turnIndex] ?? null;

  renderBoard(scoring);
  renderSequence();
  renderSummary(scoring);

  currentNumberEl.textContent = currentNumber ?? "-";
  turnCaptionEl.textContent =
    currentNumber == null
      ? "All 25 calls placed."
      : `Turn ${state.turnIndex + 1} of ${TURN_COUNT}`;
  filledCountEl.textContent = String(filledCount);
  scoreTotalEl.textContent = String(scoring.totalScore);
  bestClusterEl.textContent = String(scoring.longestGroup);
  callsRemainingEl.textContent = `${remaining} left`;
  undoBtn.disabled = state.history.length === 0;
  resetBtn.disabled = state.sequence.length === 0;
}

newGameBtn.addEventListener("click", () => resetBoard(buildRandomSequence(), "Fresh random sequence loaded."));

resetBtn.addEventListener("click", () => {
  if (state.sequence.length === 0) {
    return;
  }
  resetBoard(state.sequence, "Board cleared. Sequence preserved.");
});

undoBtn.addEventListener("click", undoMove);

loadSequenceBtn.addEventListener("click", () => {
  try {
    const sequence = parseSequence(sequenceInputEl.value);
    resetBoard(sequence, "Custom sequence loaded.");
  } catch (error) {
    setMessage(error.message);
  }
});

resetBoard(buildRandomSequence(), "Neighbors is ready. Place the first called number anywhere.");
