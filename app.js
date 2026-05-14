const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const PAIRS = [
  ["A", "M"], ["B", "Q"], ["C", "D"], ["E", "T"], ["F", "K"],
  ["G", "Z"], ["H", "L"], ["I", "R"], ["J", "W"], ["N", "Y"],
  ["O", "U"], ["P", "X"], ["S", "V"]
];

const pairMap = {};
PAIRS.forEach(([a, b]) => {
  pairMap[a] = b;
  pairMap[b] = a;
});

const svg = document.getElementById("rotorSvg");
const keyButtons = document.getElementById("keyButtons");
const encryptBtn = document.getElementById("encryptBtn");
const decryptBtn = document.getElementById("decryptBtn");
const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");
const startBtn = document.getElementById("startBtn");
const stepBtn = document.getElementById("stepBtn");
const resetBtn = document.getElementById("resetBtn");
const plainText = document.getElementById("plainText");
const cipherText = document.getElementById("cipherText");
const rotorState = document.getElementById("rotorState");
const stepState = document.getElementById("stepState");
const explainBox = document.getElementById("explainBox");

let selectedKey = "A";
let rotorOffset = 0;
let currentIndex = 0;
let running = false;
let inputText = "";
let outputText = "";
let mode = "encrypt";

const letterNodes = {};
const textNodes = {};
const wireNodes = [];
const socketNodes = [];

const CX = 450;
const CY = 450;
const OUTER_R = 365;
const ROTOR_R = 270;
const SOCKET_R = 220;
const INNER_R = 110;

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function indexOf(letter) {
  return ALPHABET.indexOf(letter);
}

function angleOf(index) {
  return index * (360 / 26);
}

function polar(radius, angleDeg) {
  const angle = (angleDeg - 90) * Math.PI / 180;
  return {
    x: CX + radius * Math.cos(angle),
    y: CY + radius * Math.sin(angle)
  };
}

function buildKeyButtons() {
  ALPHABET.forEach(letter => {
    const btn = document.createElement("button");
    btn.className = "key";
    btn.textContent = letter;
    btn.dataset.letter = letter;

    btn.addEventListener("click", () => {
      selectedKey = letter;
      resetAll();
    });

    keyButtons.appendChild(btn);
  });

  updateKeyButtons();
}

function updateKeyButtons() {
  document.querySelectorAll(".key").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.letter === selectedKey);
  });
}

function buildRotor() {
  svg.innerHTML = "";
  wireNodes.length = 0;
  socketNodes.length = 0;

  svg.appendChild(svgEl("circle", {
    cx: CX,
    cy: CY,
    r: 400,
    class: "outer-ring"
  }));

  svg.appendChild(svgEl("path", {
    d: "M450 36 L435 72 L465 72 Z",
    class: "pointer"
  }));

  const rotorGroup = svgEl("g", { id: "rotorGroup" });
  svg.appendChild(rotorGroup);

  rotorGroup.appendChild(svgEl("circle", {
    cx: CX,
    cy: CY,
    r: ROTOR_R,
    class: "rotor-body"
  }));

  PAIRS.forEach((pair, pairIndex) => {
    const [a, b] = pair;
    const path = buildWirePath(a, b, pairIndex);

    const wire = svgEl("path", {
      d: path.d,
      class: "wire",
      "data-a": a,
      "data-b": b
    });

    rotorGroup.appendChild(wire);
    wireNodes.push(wire);

    const s1 = svgEl("circle", {
      cx: path.start.x,
      cy: path.start.y,
      r: 7,
      class: "socket",
      "data-letter": a
    });

    const s2 = svgEl("circle", {
      cx: path.end.x,
      cy: path.end.y,
      r: 7,
      class: "socket",
      "data-letter": b
    });

    rotorGroup.appendChild(s1);
    rotorGroup.appendChild(s2);
    socketNodes.push(s1, s2);
  });

  rotorGroup.appendChild(svgEl("circle", {
    cx: CX,
    cy: CY,
    r: INNER_R,
    class: "inner-hole"
  }));

  rotorGroup.appendChild(svgEl("circle", {
    cx: CX,
    cy: CY,
    r: 34,
    class: "center-dot"
  }));

  ALPHABET.forEach((letter, i) => {
    const p = polar(OUTER_R, angleOf(i));

    const circle = svgEl("circle", {
      cx: p.x,
      cy: p.y,
      r: 28,
      class: "letter-circle",
      "data-letter": letter
    });

    const text = svgEl("text", {
      x: p.x,
      y: p.y + 2,
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

function buildWirePath(a, b, pairIndex) {
  const ia = indexOf(a);
  const ib = indexOf(b);

  const start = polar(SOCKET_R, angleOf(ia));
  const end = polar(SOCKET_R, angleOf(ib));

  const midRadiusA = 145 + (pairIndex % 4) * 18;
  const midRadiusB = 150 + ((pairIndex + 2) % 4) * 18;

  const pa = polar(midRadiusA, angleOf(ia));
  const pb = polar(midRadiusB, angleOf(ib));

  const bend1 = orthogonalBend(start, pa);
  const bend2 = orthogonalBend(pa, pb);
  const bend3 = orthogonalBend(pb, end);

  const d = [
    `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`,
    `L ${bend1.x.toFixed(1)} ${bend1.y.toFixed(1)}`,
    `L ${pa.x.toFixed(1)} ${pa.y.toFixed(1)}`,
    `L ${bend2.x.toFixed(1)} ${bend2.y.toFixed(1)}`,
    `L ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`,
    `L ${bend3.x.toFixed(1)} ${bend3.y.toFixed(1)}`,
    `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  ].join(" ");

  return { d, start, end };
}

function orthogonalBend(p1, p2) {
  const horizontalFirst = Math.abs(p1.x - CX) > Math.abs(p1.y - CY);

  if (horizontalFirst) {
    return { x: p2.x, y: p1.y };
  }

  return { x: p1.x, y: p2.y };
}

function setMode(newMode) {
  mode = newMode;
  encryptBtn.classList.toggle("active", mode === "encrypt");
  decryptBtn.classList.toggle("active", mode === "decrypt");
  resetAll();
}

function setRotorFromKey() {
  rotorOffset = indexOf(selectedKey);
  updateRotorRotation();
  updateRotorState();
  updateKeyButtons();
}

function updateRotorRotation() {
  const group = document.getElementById("rotorGroup");
  if (!group) return;

  const degrees = rotorOffset * (360 / 26);
  group.setAttribute("transform", `rotate(${degrees} ${CX} ${CY})`);
}

function updateRotorState() {
  rotorState.textContent = ALPHABET[rotorOffset % 26];
}

function shiftedToRotorLetter(screenLetter) {
  const screenIndex = indexOf(screenLetter);
  const rotorIndex = (screenIndex - rotorOffset + 26) % 26;
  return ALPHABET[rotorIndex];
}

function rotorToScreenLetter(rotorLetter) {
  const rotorIndex = indexOf(rotorLetter);
  const screenIndex = (rotorIndex + rotorOffset) % 26;
  return ALPHABET[screenIndex];
}

function transformLetter(screenLetter) {
  const rotorInput = shiftedToRotorLetter(screenLetter);
  const rotorOutput = pairMap[rotorInput];
  const screenOutput = rotorToScreenLetter(rotorOutput);

  return {
    rotorInput,
    rotorOutput,
    screenOutput
  };
}

function clearHighlights() {
  Object.values(letterNodes).forEach(node => {
    node.classList.remove("active-in", "active-out");
  });

  Object.values(textNodes).forEach(node => {
    node.classList.remove("dark");
  });

  wireNodes.forEach(node => {
    node.classList.remove("active");
  });

  socketNodes.forEach(node => {
    node.classList.remove("active");
  });
}

function findWire(a, b) {
  return wireNodes.find(wire => {
    const wa = wire.dataset.a;
    const wb = wire.dataset.b;
    return (wa === a && wb === b) || (wa === b && wb === a);
  });
}

function highlightSockets(a, b) {
  socketNodes.forEach(socket => {
    if (socket.dataset.letter === a || socket.dataset.letter === b) {
      socket.classList.add("active");
    }
  });
}

function rotateOneStep() {
  rotorOffset = (rotorOffset + 1) % 26;
  updateRotorRotation();
  updateRotorState();
}

function prepareRun() {
  inputText = mode === "encrypt"
    ? plainText.value.toUpperCase()
    : cipherText.value.toUpperCase();

  outputText = "";
  currentIndex = 0;

  setRotorFromKey();
  clearHighlights();

  if (mode === "encrypt") {
    cipherText.value = "";
  } else {
    plainText.value = "";
  }
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
    running = false;
    stepState.textContent = "fertig";
    explainBox.textContent = "Die Nachricht ist fertig verarbeitet.";
    setButtons(false);
    return false;
  }

  clearHighlights();

  const char = inputText[currentIndex];

  if (!ALPHABET.includes(char)) {
    outputText += char;
    writeOutput();
    currentIndex++;

    stepState.textContent = "übersprungen";
    explainBox.textContent = `„${char}“ ist kein Buchstabe A–Z und bleibt unverändert.`;

    return true;
  }

  const result = transformLetter(char);
  const wire = findWire(result.rotorInput, result.rotorOutput);

  letterNodes[char].classList.add("active-in");
  textNodes[char].classList.add("dark");

  stepState.textContent = `${char} → ?`;
  explainBox.textContent = `Der Strom tritt bei ${char} ein. Im Rotor landet er beim Anschluss ${result.rotorInput}.`;

  await wait(phaseDuration());

  if (wire) {
    wire.classList.add("active");
  }

  highlightSockets(result.rotorInput, result.rotorOutput);

  explainBox.textContent = `Im Rotor folgt der Strom dem Draht von ${result.rotorInput} nach ${result.rotorOutput}.`;

  await wait(phaseDuration());

  letterNodes[result.screenOutput].classList.add("active-out");
  textNodes[result.screenOutput].classList.add("dark");

  outputText += result.screenOutput;
  writeOutput();

  stepState.textContent = `${char} → ${result.screenOutput}`;
  explainBox.textContent = `${char} wird zu ${result.screenOutput}. Danach dreht sich der Rotor einen Schritt weiter.`;

  await wait(phaseDuration());

  rotateOneStep();
  currentIndex++;

  return true;
}

function phaseDuration() {
  const charsPerSecond = Number(speedRange.value);

  const millisecondsPerCharacter = 1000 / charsPerSecond;

  return millisecondsPerCharacter / 3;
}

function updateSpeedLabel() {
  speedLabel.textContent = speedRange.value;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setButtons(disabled) {
  startBtn.disabled = disabled;
  stepBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  encryptBtn.disabled = disabled;
  decryptBtn.disabled = disabled;

  document.querySelectorAll(".key").forEach(btn => {
    btn.disabled = disabled;
  });
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

  setRotorFromKey();
  clearHighlights();

  stepState.textContent = "bereit";
  explainBox.textContent = "Gib einen Text ein und starte die Animation.";
}

function normalizeTextareas() {
  plainText.value = plainText.value.toUpperCase();
  cipherText.value = cipherText.value.toUpperCase();
}

buildKeyButtons();
buildRotor();
setRotorFromKey();
updateSpeedLabel();

encryptBtn.addEventListener("click", () => setMode("encrypt"));
decryptBtn.addEventListener("click", () => setMode("decrypt"));
startBtn.addEventListener("click", runAll);
stepBtn.addEventListener("click", runStep);
resetBtn.addEventListener("click", resetAll);

speedRange.addEventListener("input", updateSpeedLabel);

plainText.addEventListener("input", normalizeTextareas);
cipherText.addEventListener("input", normalizeTextareas);
