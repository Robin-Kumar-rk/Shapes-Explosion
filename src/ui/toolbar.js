function notify(listeners, value) {
  for (const listener of listeners) {
    listener(value);
  }
}

export function createToolbar() {
  const shapeButtons = [...document.querySelectorAll(".shape-btn")];
  const colorPicker = document.getElementById("colorPicker");
  const bombToolButton = document.getElementById("bombTool");
  const clearButton = document.getElementById("clearBtn");
  const unbreakableButton = document.getElementById("unbreakableBtn");
  const pauseButton = document.getElementById("pauseBtn");
  const pauseIcon = pauseButton.querySelector(".icon-pause");
  const playIcon = pauseButton.querySelector(".icon-play");
  const helpButton = document.getElementById("helpBtn");
  const helpModal = document.getElementById("helpModal");
  const helpCloseButton = document.getElementById("helpCloseBtn");
  const speedSlider = document.getElementById("speedSlider");
  const speedValue = document.getElementById("speedValue");
  const strengthSlider = document.getElementById("strengthSlider");
  const strengthValue = document.getElementById("strengthValue");
  const bombPowerSlider = document.getElementById("bombPowerSlider");
  const bombPowerValue = document.getElementById("bombPowerValue");

  const pauseListeners = [];
  const speedListeners = [];
  const strengthListeners = [];
  const bombPowerListeners = [];
  const toolListeners = [];

  let bombMode = false;
  let clearMode = false;
  let unbreakableMode = false;
  let paused = false;
  let helpOpen = false;
  let selectedShape = shapeButtons[0]?.dataset.shape || "rectangle";

  function renderSelectedShape() {
    const drawModeActive = !bombMode && !clearMode;
    for (const button of shapeButtons) {
      button.classList.toggle(
        "active",
        drawModeActive && button.dataset.shape === selectedShape
      );
    }
  }

  function renderBombMode() {
    bombToolButton.classList.toggle("active", bombMode);
  }

  function renderClearMode() {
    clearButton.classList.toggle("active", clearMode);
  }

  function renderUnbreakableMode() {
    const drawModeActive = !bombMode && !clearMode;
    unbreakableButton.classList.toggle("active", drawModeActive && unbreakableMode);
  }

  function renderPauseState() {
    pauseButton.classList.toggle("active", paused);
    if (pauseIcon) {
      pauseIcon.hidden = paused;
    }
    if (playIcon) {
      playIcon.hidden = !paused;
    }
    pauseButton.title = paused ? "Resume Physics" : "Pause Physics";
    pauseButton.setAttribute("aria-label", paused ? "Resume Physics" : "Pause Physics");
  }

  function setBombMode(nextValue) {
    bombMode = Boolean(nextValue);
    if (bombMode) {
      clearMode = false;
    }
    renderSelectedShape();
    renderBombMode();
    renderClearMode();
    renderUnbreakableMode();
    notify(toolListeners, { bombMode, clearMode, unbreakableMode });
  }

  function setClearMode(nextValue) {
    clearMode = Boolean(nextValue);
    if (clearMode) {
      bombMode = false;
    }
    renderSelectedShape();
    renderClearMode();
    renderBombMode();
    renderUnbreakableMode();
    notify(toolListeners, { bombMode, clearMode, unbreakableMode });
  }

  function setUnbreakableMode(nextValue) {
    unbreakableMode = Boolean(nextValue);
    renderUnbreakableMode();
    notify(toolListeners, { bombMode, clearMode, unbreakableMode });
  }

  function updateScaleLabel(target, value) {
    target.textContent = `${value.toFixed(1)}x`;
  }

  function renderHelpState() {
    helpButton.classList.toggle("active", helpOpen);
    helpModal.hidden = !helpOpen;
  }

  function setHelpOpen(nextValue) {
    helpOpen = Boolean(nextValue);
    renderHelpState();
  }

  bombToolButton.addEventListener("click", () => {
    setBombMode(!bombMode);
  });

  for (const button of shapeButtons) {
    button.addEventListener("click", () => {
      selectedShape = button.dataset.shape;
      renderSelectedShape();
      if (bombMode) {
        setBombMode(false);
      }
      if (clearMode) {
        setClearMode(false);
      }
    });
  }

  clearButton.addEventListener("click", () => {
    setClearMode(!clearMode);
  });

  unbreakableButton.addEventListener("click", () => {
    setUnbreakableMode(!unbreakableMode);
  });

  pauseButton.addEventListener("click", () => {
    paused = !paused;
    renderPauseState();
    notify(pauseListeners, paused);
  });

  helpButton.addEventListener("click", () => {
    setHelpOpen(!helpOpen);
  });

  helpCloseButton.addEventListener("click", () => {
    setHelpOpen(false);
  });

  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) {
      setHelpOpen(false);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && helpOpen) {
      setHelpOpen(false);
    }
  });

  speedSlider.addEventListener("input", () => {
    const speed = Number.parseFloat(speedSlider.value);
    updateScaleLabel(speedValue, speed);
    notify(speedListeners, speed);
  });

  strengthSlider.addEventListener("input", () => {
    const strength = Number.parseFloat(strengthSlider.value);
    updateScaleLabel(strengthValue, strength);
    notify(strengthListeners, strength);
  });

  bombPowerSlider.addEventListener("input", () => {
    const bombPower = Number.parseFloat(bombPowerSlider.value);
    updateScaleLabel(bombPowerValue, bombPower);
    notify(bombPowerListeners, bombPower);
  });

  updateScaleLabel(speedValue, Number.parseFloat(speedSlider.value));
  updateScaleLabel(strengthValue, Number.parseFloat(strengthSlider.value));
  updateScaleLabel(bombPowerValue, Number.parseFloat(bombPowerSlider.value));
  renderSelectedShape();
  renderBombMode();
  renderClearMode();
  renderUnbreakableMode();
  renderPauseState();
  renderHelpState();

  return {
    getSelectedShape() {
      return selectedShape;
    },
    getSelectedColor() {
      return colorPicker.value;
    },
    getSpeed() {
      return Number.parseFloat(speedSlider.value);
    },
    getObjectStrength() {
      return Number.parseFloat(strengthSlider.value);
    },
    getBombPower() {
      return Number.parseFloat(bombPowerSlider.value);
    },
    isBombMode() {
      return bombMode;
    },
    isClearMode() {
      return clearMode;
    },
    isUnbreakableMode() {
      return unbreakableMode;
    },
    setBombMode,
    setClearMode,
    setUnbreakableMode,
    onPauseChange(listener) {
      pauseListeners.push(listener);
    },
    onSpeedChange(listener) {
      speedListeners.push(listener);
    },
    onObjectStrengthChange(listener) {
      strengthListeners.push(listener);
    },
    onBombPowerChange(listener) {
      bombPowerListeners.push(listener);
    },
    onToolChange(listener) {
      toolListeners.push(listener);
    }
  };
}
