document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const els = {
    apiUrl: $("api-url"),
    apiToken: $("api-token"),
    saveConfig: $("save-config"),
    codeEditor: $("code-editor"),
    instructionInput: $("instruction-input"),
    chatInput: $("chat-input"),
    outputDisplay: $("output-display"),
    spinner: $("spinner"),
    fileInput: $("file-input"),
    btnOpenFile: $("btn-open-file"),
    btnSendCode: $("btn-send-code"),
    btnClearCode: $("btn-clear-code"),
    btnSendChat: $("btn-send-chat"),
    btnCopy: $("btn-copy"),
    btnDownload: $("btn-download"),
    btnClearOutput: $("btn-clear-output"),
  };
  const ls = localStorage;
  els.apiUrl.value =
    ls.getItem("gemini_api_url") ||
    `${location.protocol}//${location.hostname}:9000`;
  els.apiToken.value = ls.getItem("gemini_api_token") || "";

  const saveConfig = () => {
    ls.setItem("gemini_api_url", els.apiUrl.value.replace(/\/$/, ""));
    ls.setItem("gemini_api_token", els.apiToken.value);
    alert("Configuration saved.");
  };
  const debounce = (fn, wait) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };
  const headers = () => ({
    "Content-Type": "application/json",
    "X-API-KEY": els.apiToken.value,
  });
  const setLoading = (on) => {
    els.spinner.classList.toggle("hidden", !on);
    [els.btnSendChat, els.btnSendCode].forEach((b) => (b.disabled = on));
  };

  let batch = [],
    batchTimer = null;
  const flush = () => {
    if (!batch.length) return;
    const frag = document.createDocumentFragment();
    for (const { text, type } of batch) {
      const d = document.createElement("div");
      d.className =
        type === "error"
          ? "error-msg"
          : type === "user"
            ? "user-msg"
            : "ai-msg";
      d.textContent = text;
      frag.appendChild(d);
    }
    els.outputDisplay.appendChild(frag);
    els.outputDisplay.scrollTop = els.outputDisplay.scrollHeight;
    batch.length = 0;
  };
  const log = (text, type = "normal") => {
    batch.push({ text, type });
    if (batchTimer) clearTimeout(batchTimer);
    batch.length > 10 ? flush() : (batchTimer = setTimeout(flush, 16));
  };

  const apiRequest = async (endpoint, payload) => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    try {
      setLoading(true);
      const res = await fetch(`${els.apiUrl.value}${endpoint}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!res.ok) {
        if (res.status === 401)
          throw new Error("401 Unauthorized: Check API Token");
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(tid);
      if (err.name === "AbortError")
        throw new Error("Request timed out (server unreachable?)");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    const prompt = els.chatInput.value.trim();
    if (!prompt) return;
    log(`> ${prompt}`, "user");
    els.chatInput.value = "";
    try {
      const data = await apiRequest("/chat", { prompt });
      log(data.text || JSON.stringify(data));
    } catch (e) {
      log(e.message, "error");
    }
  };
  const sendCode = async () => {
    const code = els.codeEditor.value;
    const instruction = els.instructionInput.value.trim();
    if (!code && !instruction)
      return log("Error: Code or instruction required", "error");
    log(`> Processing code with instruction: ${instruction}`, "user");
    try {
      const data = await apiRequest("/code", { code, instruction });
      log(data.text || JSON.stringify(data));
    } catch (e) {
      log(e.message, "error");
    }
  };
  const loadFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      els.codeEditor.value = e.target.result;
    };
    r.readAsText(file);
  };

  // Events
  els.saveConfig.addEventListener("click", saveConfig);
  els.btnSendChat.addEventListener("click", debounce(sendChat, 300));
  els.btnSendCode.addEventListener("click", debounce(sendCode, 300));
  els.btnClearCode.addEventListener("click", () => {
    els.codeEditor.value = "";
  });
  els.btnClearOutput.addEventListener("click", () => {
    els.outputDisplay.textContent = "";
    batch.length = 0;
    if (batchTimer) clearTimeout(batchTimer);
  });
  els.btnCopy.addEventListener("click", () => {
    navigator.clipboard
      .writeText(els.outputDisplay.textContent)
      .then(() => alert("Copied output to clipboard"))
      .catch((err) => alert(`Failed to copy: ${err.message}`));
  });
  els.btnDownload.addEventListener("click", () => {
    const blob = new Blob([els.outputDisplay.textContent], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gemini-output-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
  els.btnOpenFile.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (e) => loadFile(e.target.files[0]));

  // Drag & drop
  els.codeEditor.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.codeEditor.style.borderColor = "#007acc";
  });
  els.codeEditor.addEventListener("dragleave", (e) => {
    e.preventDefault();
    els.codeEditor.style.borderColor = "#3e3e42";
  });
  els.codeEditor.addEventListener("drop", (e) => {
    e.preventDefault();
    els.codeEditor.style.borderColor = "#3e3e42";
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });
});
