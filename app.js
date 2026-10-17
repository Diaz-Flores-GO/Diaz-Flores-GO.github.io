const TEXT_KEY = "textoClaroText";
const RESULT_KEY = "textoClaroAnalysis";
const MAX_TEXT_LENGTH = 18000;

const exampleText = "La educación influye en las oportunidades de las personas y en el desarrollo de sus comunidades. En el aula, aprender no consiste solo en memorizar datos; también implica hacer preguntas, contrastar fuentes y relacionar ideas. Por ejemplo, un proyecto sobre el agua puede combinar conocimientos de ciencias, historia y participación ciudadana. Cuando los estudiantes explican sus conclusiones con sus propias palabras, pueden reconocer mejor qué comprenden y qué necesitan investigar. Por eso, las actividades prácticas y la conversación respetuosa son una parte valiosa del aprendizaje.";

function tokenize(text) {
  return text.match(/[\p{L}\p{N}]+/gu) || [];
}

function analyzeText(text) {
  const words = tokenize(text);
  const sentences = text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (words.length < 30 || sentences.length < 2) {
    return {
      error: "Agrega al menos 30 palabras y dos oraciones para revisar algunos patrones de estilo."
    };
  }

  const frequencies = new Map();
  for (const word of words) {
    const normalized = word.toLocaleLowerCase("es");
    frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
  }

  const repeatedWordRatio =
    [...frequencies.values()].filter(count => count > 1).length / frequencies.size;
  const sentenceLengths = sentences.map(sentence => tokenize(sentence).length);
  const meanLength = sentenceLengths.reduce((sum, length) => sum + length, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, length) => sum + (length - meanLength) ** 2, 0) / sentenceLengths.length;
  const lengthVariation = Math.sqrt(variance);
  const lexicalDiversity = frequencies.size / words.length;

  const repetitionSignal = Math.max(0, Math.min(1, (repeatedWordRatio - 0.15) / 0.35));
  const uniformitySignal = Math.max(0, Math.min(1, (4 - lengthVariation) / 4));
  const diversitySignal = Math.max(0, Math.min(1, (0.72 - lexicalDiversity) / 0.42));
  const score = Math.round(
    (repetitionSignal * 0.35 + uniformitySignal * 0.4 + diversitySignal * 0.25) * 100
  );

  const observations = [
    `Se revisaron ${words.length} palabras y ${sentences.length} oraciones.`,
    `Variación en la longitud de las oraciones: ${lengthVariation.toFixed(1)} palabras.`,
    `Diversidad de vocabulario: ${Math.round(lexicalDiversity * 100)}%.`,
    `Palabras repetidas: ${Math.round(repeatedWordRatio * 100)}% de las palabras distintas aparecen más de una vez.`
  ];

  if (lengthVariation < 3) {
    observations.push("Las oraciones tienen longitudes parecidas.");
  } else {
    observations.push("Hay variación en la longitud de las oraciones.");
  }
  if (repeatedWordRatio > 0.28) {
    observations.push("Se repiten varias palabras en el texto.");
  }

  return {
    score,
    words: words.length,
    sentences: sentences.length,
    sentenceLengths,
    reply: `Resultado orientativo: ${score}% de coincidencia con los patrones sencillos analizados.\n${observations.map(item => `• ${item}`).join("\n")}\n\nEste porcentaje no es una probabilidad ni permite determinar quién escribió el texto.`
  };
}

const substitutions = [
  [/\bdebido a que\b/gi, "porque"],
  [/\bcon el objetivo de\b/gi, "para"],
  [/\ben la actualidad\b/gi, "hoy en día"],
  [/\bpor otra parte\b/gi, "además"],
  [/\butilizar\b/gi, "usar"],
  [/\butiliza\b/gi, "usa"],
  [/\butilizan\b/gi, "usan"],
  [/\bcomenzar\b/gi, "empezar"],
  [/\bcomienza\b/gi, "empieza"],
  [/\bfinalizar\b/gi, "terminar"],
  [/\bfinaliza\b/gi, "termina"],
  [/\bimportante\b/gi, "relevante"],
  [/\bmostrar\b/gi, "presentar"]
];

function paraphraseText(text) {
  let rewritten = text;
  for (const [pattern, replacement] of substitutions) {
    rewritten = rewritten.replace(pattern, match => {
      return match[0] === match[0].toLocaleUpperCase("es")
        ? replacement.charAt(0).toLocaleUpperCase("es") + replacement.slice(1)
        : replacement;
    });
  }
  return rewritten === text
    ? `${text}\nNo encontré expresiones de la lista básica para cambiar.`
    : rewritten;
}

function addMessage(chatLog, text, speaker) {
  const message = document.createElement("div");
  message.className = `message ${speaker}`;
  message.textContent = text;
  chatLog.append(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateWordCount(text) {
  const count = tokenize(text).length;
  document.querySelector("#word-count").textContent =
    `${count.toLocaleString("es")} ${count === 1 ? "palabra" : "palabras"}`;
}

function updateScore(score) {
  document.querySelector("#home-ai-score").textContent = `${score}%`;
  document.querySelector("#home-score-fill").style.width = `${score}%`;
  document.querySelector("#home-score-bar").setAttribute("aria-valuenow", String(score));
}

function resetResults() {
  updateScore(0);
  document.querySelector("#home-verdict").textContent =
    "El resultado orientativo aparecerá aquí cuando analices un texto.";
  document.querySelector("#home-analysis-summary").textContent =
    "Aún no hay observaciones. Pega un texto y pulsa “Detectar IA”.";
}

function displayResults(result) {
  updateScore(result.score);
  document.querySelector("#home-verdict").textContent =
    `Coincidencia orientativa con patrones de estilo: ${result.score}%. No es una probabilidad de autoría.`;
  document.querySelector("#home-analysis-summary").textContent = result.reply;
}

function initializeChat() {
  const chatInput = document.querySelector("#chat-input");
  const chatLog = document.querySelector("#chat-log");
  const savedText = sessionStorage.getItem(TEXT_KEY) || "";
  const fileInput = document.querySelector("#file-input");

  chatInput.value = savedText;
  updateWordCount(savedText);
  chatInput.addEventListener("input", () => {
    updateWordCount(chatInput.value);
    sessionStorage.removeItem(RESULT_KEY);
    resetResults();
  });

  document.querySelector("#analyze-button").addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) {
      addMessage(chatLog, "Pega o escribe un texto antes de iniciar el análisis.", "assistant");
      chatInput.focus();
      return;
    }

    sessionStorage.setItem(TEXT_KEY, text);
    const result = analyzeText(text);
    if (result.error) {
      sessionStorage.removeItem(RESULT_KEY);
      resetResults();
      document.querySelector("#home-analysis-summary").textContent = result.error;
      addMessage(chatLog, result.error, "assistant");
      return;
    }

    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
    displayResults(result);
    addMessage(chatLog, text, "user");
    addMessage(chatLog, result.reply, "assistant");
  });

  document.querySelector("#rewrite-button").addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) {
      addMessage(chatLog, "Escribe o pega un texto para parafrasear.", "assistant");
      chatInput.focus();
      return;
    }
    addMessage(chatLog, text, "user");
    addMessage(chatLog, paraphraseText(text), "assistant");
  });

  document.querySelector("#paste-button").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        addMessage(chatLog, "El portapapeles está vacío.", "assistant");
        return;
      }
      chatInput.value = text.slice(0, MAX_TEXT_LENGTH);
      updateWordCount(chatInput.value);
      chatInput.focus();
      if (text.length > MAX_TEXT_LENGTH) {
        addMessage(chatLog, "El texto se recortó al límite de 18 000 caracteres.", "assistant");
      }
    } catch {
      addMessage(chatLog, "No se pudo acceder al portapapeles. Usa Ctrl+V en el cuadro de texto.", "assistant");
    }
  });

  document.querySelector("#upload-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files || [];
    if (!file) return;
    if (file.size > MAX_TEXT_LENGTH * 4) {
      addMessage(chatLog, "El archivo supera el límite permitido para texto plano.", "assistant");
      fileInput.value = "";
      return;
    }
    try {
      const text = await file.text();
      chatInput.value = text.slice(0, MAX_TEXT_LENGTH);
      updateWordCount(chatInput.value);
      chatInput.focus();
      if (text.length > MAX_TEXT_LENGTH) {
        addMessage(chatLog, "El contenido se recortó al límite de 18 000 caracteres.", "assistant");
      }
    } catch {
      addMessage(chatLog, "No se pudo leer el archivo. Prueba con un archivo .txt válido.", "assistant");
    } finally {
      fileInput.value = "";
    }
  });

  document.querySelector("#example-button").addEventListener("click", () => {
    chatInput.value = exampleText;
    updateWordCount(chatInput.value);
    chatInput.focus();
  });

  document.querySelector("#clear-button").addEventListener("click", () => {
    chatLog.innerHTML = '<div class="message assistant">Pega tu texto y elige.</div>';
    chatInput.value = "";
    updateWordCount("");
    sessionStorage.removeItem(TEXT_KEY);
    sessionStorage.removeItem(RESULT_KEY);
    resetResults();
    chatInput.focus();
  });

  document.querySelector("#export-button").addEventListener("click", () => window.print());
}

function restoreResults() {
  const rawResult = sessionStorage.getItem(RESULT_KEY);
  if (!rawResult) return;

  let result;
  try {
    result = JSON.parse(rawResult);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    document.querySelector("#home-analysis-summary").textContent =
      "No se pudo leer el resultado guardado. Ejecuta el análisis de nuevo.";
    return;
  }

  const validResult = result &&
    Number.isInteger(result.score) && result.score >= 0 && result.score <= 100 &&
    Number.isInteger(result.words) && result.words >= 30 &&
    Number.isInteger(result.sentences) && result.sentences >= 2 &&
    typeof result.reply === "string";

  if (validResult) displayResults(result);
  else document.querySelector("#home-analysis-summary").textContent =
    "El resultado guardado no es válido. Ejecuta el análisis de nuevo.";
}

initializeChat();
restoreResults();
