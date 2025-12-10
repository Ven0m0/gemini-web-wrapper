document.addEventListener("DOMContentLoaded", () => {
  // Config & State
  const els = {
    apiUrl: document.getElementById("api-url"),
    apiToken: document.getElementById("api-token"),
    saveConfig: document.getElementById("save-config"),
    codeEditor: document.getElementById("code-editor"),
    instructionInput: document.getElementById("instruction-input"),
    chatInput: document.getElementById("chat-input"),
    outputDisplay: document.getElementById("output-display"),
    spinner: document.getElementById("spinner"),
    fileInput: document.getElementById("file-input"),
    // Buttons
    btnOpenFile: document.getElementById("btn-open-file"),
    btnSendCode: document.getElementById("btn-send-code"),
    btnClearCode: document.getElementById("btn-clear-code"),
    btnSendChat: document.getElementById("btn-send-chat"),
    btnCopy: document.getElementById("btn-copy"),
    btnDownload: document.getElementById("btn-download"),
    btnClearOutput: document.getElementById("btn-clear-output"),
  };

  // Initialize Config
  els.apiUrl.value =
    localStorage.getItem("gemini_api_url") ||
    `${window.location.protocol}//${window.location.hostname}:9000`;
  els.apiToken.value = localStorage.getItem("gemini_api_token") || "";

  // Helpers
  const saveConfig = () => {
    localStorage.setItem("gemini_api_url", els.apiUrl.value.replace(/\/$/, ""));
    localStorage.setItem("gemini_api_token", els.apiToken.value);
    alert("Configuration saved.");
  };

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "X-API-KEY": els.apiToken.value,
  });

  const setLoading = (loading) => {
    els.spinner.classList.toggle("hidden", !loading);
    [els.btnSendChat, els.btnSendCode].forEach((b) => (b.disabled = loading));
  };

  const appendLog = (text, type = "normal") => {
    const div = document.createElement("div");
    div.className =
      type === "error" ? "error-msg" : type === "user" ? "user-msg" : "ai-msg";
    div.textContent = text; // Safe textContent injection
    els.outputDisplay.appendChild(div);
    els.outputDisplay.scrollTop = els.outputDisplay.scrollHeight;
  };

  const apiRequest = async (endpoint, payload) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      setLoading(true);
      const res = await fetch(`${els.apiUrl.value}${endpoint}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        if (res.status === 401)
          throw new Error("401 Unauthorized: Check API Token");
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(id);
      if (err.name === "AbortError")
        throw new Error("Request timed out (server unreachable?)");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleSendChat = async () => {
    const prompt = els.chatInput.value.trim();
    if (!prompt) return;

    appendLog(`> ${prompt}`, "user");
    els.chatInput.value = "";

    try {
      const data = await apiRequest("/chat", { prompt });
      appendLog(data.text || JSON.stringify(data));
    } catch (e) {
      appendLog(e.message, "error");
    }
  };

  const handleSendCode = async () => {
    const code = els.codeEditor.value;
    const instruction = els.instructionInput.value.trim();

    if (!code && !instruction)
      return appendLog("Error: Code or instruction required", "error");

    appendLog(`> Processing code with instruction: ${instruction}`, "user");

    try {
      const data = await apiRequest("/code", { code, instruction });
      appendLog(data.text || JSON.stringify(data));
    } catch (e) {
      appendLog(e.message, "error");
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => (els.codeEditor.value = e.target.result);
    reader.readAsText(file);
  };

  // Event Listeners
  els.saveConfig.addEventListener("click", saveConfig);
  els.btnSendChat.addEventListener("click", handleSendChat);
  els.btnSendCode.addEventListener("click", handleSendCode);
  els.btnClearCode.addEventListener("click", () => (els.codeEditor.value = ""));
  els.btnClearOutput.addEventListener(
    "click",
    () => (els.outputDisplay.textContent = ""),
  );

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
  els.fileInput.addEventListener("change", (e) =>
    handleFileUpload(e.target.files[0]),
  );

  // Drag & Drop
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
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
  });
});
