const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/*
  Vereinfachter didaktischer Rotor:
  Jeder Buchstabe ist mit genau einem anderen Buchstaben verbunden.
  Die Paare sind absichtlich gespiegelt, damit dieselbe Maschine
  sowohl verschlüsseln als auch entschlüsseln kann.
*/
const PAIRS = [
  ["A", "M"], ["B", "Q"], ["C", "D"], ["E", "T"], ["F", "K"],
  ["G", "Z"], ["H", "L"], ["I", "R"], ["J", "W"], ["N", "Y"],
  ["O", "U"], ["P", "X"], ["S", "V"]
];

const pairMap = {};
for (const [a, b] of PAIRS) {
  pairMap[a] = b;
  pairMap[b] = a;
}

const svg = document.getElementById("rotorSvg");
const keySelect = document.getElementById("keySelect");
const modeSelect = document.getElementById("modeSelect");
const speedRange = document.getElementById("speedRange");
const startBtn = document.getElementById("startBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const plainText = document.getElementById("plainText");
const cipherText = document.getElementById("cipherText");
const rotorState = document.getElementById("rotorState");
const stepState = document.getElementById("stepState");
const explainBox = document.getElementById("explainBox");

let rotorOffset = 0;
let currentIndex = 0;
let running = false;
let inputText = "";
let outputText = "";
let mode = "encrypt";

const letterNodes = {};
const textNodes = {};
const lineNodes = [];

function polar(cx, cy, radius, angleDeg) {
  const angle = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function letterAngle(index) {
  return index * (360 / 26);
}

function alphabetIndex(letter) {
  return ALPHABET.indexOf(letter);
}

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function buildSelectors() {
  ALPHABET.forEach(letter => {
    const option = document.createElement("option");
    option.value = letter;
    option.textContent = letter;
    keySelect.appendChild(option);
  });
}

function buildRotor() {
  svg.innerHTML = "";

  const cx = 350;
  const cy = 350;
  const outerR = 295;
  const rotorR = 225;
  const connectionR = 165;

  const bg = createSvgElement("circle", {
    cx, cy, r: 330,
    fill: "#111722",
    stroke: "#2d3749",
    "stroke-width": 5
  });
  svg.appendChild(bg);

  const pointer = createSvgElement("path", {
    d: "M350 24 L332 70 L368 70 Z",
    class: "pointer"
  });
  svg.appendChild(pointer);

  const rotorGroup = createSvgElement("g", {
    id: "rotorGroup"
  });
  svg.appendChild(rotorGroup);

  const rotorBody = createSvgElement("circle", {
    cx, cy, r: rotorR,
    class: "rotor-body"
  });
  rotorGroup.appendChild(rotorBody);

  const rotorInner = createSvgElement("circle", {
    cx, cy, r: 95,
    class: "rotor-inner"
  });
  rotorGroup.appendChild(rotorInner);

  PAIRS.forEach(([a, b]) => {
    const ia = alphabetIndex(a);
    const ib = alphabetIndex(b);
    const pa = polar(cx, cy, connectionR, letterAngle(ia));
    const pb = polar(cx, cy, connectionR, letterAngle(ib));

    const line = createSvgElement("line", {
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
      class: "rotor-line",
      "data-a": a,
      "data-b": b
    });

    rotorGroup.appendChild(line);
    lineNodes.push(line);
  });

  const centerDot = createSvgElement("circle", {
    cx, cy, r: 28,
    class: "center-dot"
  });
  rotorGroup.appendChild(centerDot);

  ALPHABET.forEach((letter, i) => {
    const p = polar(cx, cy, outerR, letterAngle(i));

    const circle = createSvgElement("circle", {
      cx: p.x,
      cy: p.y,
      r: 22,
      class: "letter-circle",
      "data-letter": letter
    });

    const text = createSvgElement("text", {
      x: p.x,
      y: p.y + 1,
      class: "letter-text",
      "data-letter": letter
    });

    text.textContent = letter;

    svg.appendChild(circle);
    svg.appendChild(text);

    letterNodes[letter] = circle;
    textNodes[letter] = text;
  });

  updateRotorRotation();
}

function setRotorOffsetFromKey() {
  rotorOffset = alphabetIndex(keySelect.value);
  updateRotorRotation();
  updateRotorState();
}

function updateRotorRotation() {
  const degrees = rotorOffset * (360 / 26);
  const rotorGroup = document.getElementById("rotorGroup");
  if (rotorGroup) {
    rotorGroup.setAttribute("transform", `rotate(${degrees} 350 350)`);
  }
}

function updateRotorState() {
  rotorState.textContent = ALPHABET[rotorOffset % 26];
}

function clearHighlights() {
  Object.values(letterNodes).forEach(node => {
    node.classList.remove("active-in", "active-out");
  });

  Object.values(textNodes).forEach(node => {
    node.classList.remove("dark");
  });

  lineNodes.forEach(line => line.classList.remove("active"));
}

function shiftedToRotorLetter(screenLetter) {
  const screenIndex = alphabetIndex(screenLetter);
  const rotorIndex = (screenIndex - rotorOffset + 26) % 26;
  return ALPHABET[rotorIndex];
}

function rotorToScreenLetter(rotorLetter) {
  const rotorIndex = alphabetIndex(rotorLetter);
  const screenIndex = (rotorIndex + rotorOffset) % 26;
  return ALPHABET[screenIndex];
}

function transformLetter(screenLetter) {
  const rotorInput = shiftedToRotorLetter(screenLetter);
  const rotorOutput = pairMap[rotorInput];
  return rotorToScreenLetter(rotorOutput);
}

function findActiveLine(rotorA, rotorB) {
  return lineNodes.find(line => {
    const a = line.dataset.a;
    const b = line.dataset.b;
    return (a === rotorA && b === rotorB) || (a === rotorB && b === rotorA);
  });
}

function rotateOneStep() {
  rotorOffset = (rotorOffset + 1) % 26;
  updateRotorRotation();
  updateRotorState();
}

function prepareRun() {
  mode = modeSelect.value;
  inputText = mode === "encrypt" ? plainText.value.toUpperCase() : cipherText.value.toUpperCase();
  outputText = "";
  currentIndex = 0;
  setRotorOffsetFromKey();

  if (mode === "encrypt") {
    cipherText.value = "";
  } else {
    plainText.value = "";
  }

  clearHighlights();
}

function writeOutput() {
  if (mode === "encrypt") {
    cipherText.value = outputText;
  } else {
    plainText.value = outputText;
  }
}

async function processOneCharacter() {
  if (currentIndex >= inputText.length) {
    stepState.textContent = "fertig";
    explainBox.textContent = "Die Nachricht ist fertig verarbeitet.";
    running = false;
    setButtons(false);
    return false;
  }

  const char = inputText[currentIndex];

  clearHighlights();

  if (!ALPHABET.includes(char)) {
    outputText += char;
    writeOutput();
    currentIndex++;
    stepState.textContent = "Zeichen übersprungen";
    explainBox.textContent = `„${char}“ ist kein Buchstabe A–Z und bleibt unverändert.`;
    return true;
  }

  const rotorInput = shiftedToRotorLetter(char);
  const rotorOutput = pairMap[rotorInput];
  const result = rotorToScreenLetter(rotorOutput);

  const activeLine = findActiveLine(rotorInput, rotorOutput);

  letterNodes[char].classList.add("active-in");
  textNodes[char].classList.add("dark");

  stepState.textContent = `${char} → ?`;
  explainBox.textContent =
    `Der Buchstabe ${char} trifft beim aktuellen Rotorstand auf die Verbindung ${rotorInput}–${rotorOutput}.`;

  await wait(speed());

  if (activeLine) activeLine.classList.add("active");

  await wait(speed());

  letterNodes[result].classList.add("active-out");
  textNodes[result].classList.add("dark");

  outputText += result;
  writeOutput();

  stepState.textContent = `${char} → ${result}`;
  explainBox.textContent =
    `${char} wird zu ${result}. Danach dreht sich der Rotor um eine Position weiter.`;

  await wait(speed());

  rotateOneStep();

  currentIndex++;
  return true;
}

function speed() {
  return Number(speedRange.value);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setButtons(isRunning) {
  startBtn.disabled = isRunning;
  stepBtn.disabled = isRunning;
  resetBtn.disabled = isRunning;
  keySelect.disabled = isRunning;
  modeSelect.disabled = isRunning;
}

async function runAll() {
  if (running) return;

  prepareRun();
  running = true;
  setButtons(true);

  while (running && currentIndex < inputText.length) {
    await processOneCharacter();
  }

  running = false;
  setButtons(false);
}

async function runStep() {
  if (running) return;

  if (currentIndex === 0) {
    prepareRun();
  }

  running = true;
  setButtons(true);
  await processOneCharacter();
  running = false;
  setButtons(false);
}

function resetAll() {
  running = false;
  currentIndex = 0;
  outputText = "";
  setRotorOffsetFromKey();
  clearHighlights();
  stepState.textContent = "bereit";
  explainBox.textContent = "Gib einen Text ein und starte die Animation.";
}

function normalizeTextareas() {
  plainText.value = plainText.value.toUpperCase();
  cipherText.value = cipherText.value.toUpperCase();
}

buildSelectors();
buildRotor();
setRotorOffsetFromKey();

keySelect.addEventListener("change", resetAll);
startBtn.addEventListener("click", runAll);
stepBtn.addEventListener("click", runStep);
resetBtn.addEventListener("click", resetAll);

plainText.addEventListener("input", normalizeTextareas);
cipherText.addEventListener("input", normalizeTextareas);

plainText.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault();
    modeSelect.value = "encrypt";
    runAll();
  }
});

cipherText.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault();
    modeSelect.value = "decrypt";
    runAll();
  }
});
