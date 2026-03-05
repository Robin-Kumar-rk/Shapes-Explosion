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
  const pauseButton = document.getElementById("pauseBtn");
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
  let paused = false;
  let selectedShape = shapeButtons[0]?.dataset.shape || "rectangle";

  function renderSelectedShape() {
    for (const button of shapeButtons) {
      button.classList.toggle("active", button.dataset.shape === selectedShape);
    }
  }

  function renderBombMode() {
    bombToolButton.classList.toggle("active", bombMode);
  }

  function renderClearMode() {
    clearButton.classList.toggle("active", clearMode);
  }

  function setBombMode(nextValue) {
    bombMode = Boolean(nextValue);
    if (bombMode) {
      clearMode = false;
    }
    renderBombMode();
    renderClearMode();
    notify(toolListeners, { bombMode, clearMode });
  }

  function setClearMode(nextValue) {
    clearMode = Boolean(nextValue);
    if (clearMode) {
      bombMode = false;
    }
    renderClearMode();
    renderBombMode();
    notify(toolListeners, { bombMode, clearMode });
  }

  function updateScaleLabel(target, value) {
    target.textContent = `${value.toFixed(1)}x`;
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

  pauseButton.addEventListener("click", () => {
    paused = !paused;
    pauseButton.classList.toggle("active", paused);
    pauseButton.textContent = paused ? "Resume Physics" : "Pause Physics";
    notify(pauseListeners, paused);
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
    setBombMode,
    setClearMode,
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
