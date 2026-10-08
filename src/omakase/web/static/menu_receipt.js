/* A read-only preparation slip. The native controller owns validation and requests. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("setup-form");
    const slip = document.querySelector(".preparation-slip");
    if (!form || !slip) return;
    const field = (id) => document.getElementById(id);
    const selected = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;
    const present = (id) => Boolean(field(id)?.value.trim());
    const labels = {
      openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini",
      deepseek: "DeepSeek", openrouter: "OpenRouter", openwebui: "OpenWebUI",
    };
    const write = (name, text) => {
      const node = slip.querySelector(`[data-receipt="${name}"]`);
      if (node.textContent !== text) node.textContent = text;
    };

    function update() {
      const provider = selected("provider");
      // Read only the controller's fixed saved-key sentence, never its hint suffix.
      const savedKey = field("key-status").textContent.includes("key saved to your account.");
      const keyPresent = present("api_key");
      let modelMissing = !(keyPresent || savedKey);
      let modelStatus = keyPresent ? "key entered" : savedKey ? "saved key available" : "add a key";
      if (provider === "openwebui") {
        let httpsUrl = false;
        try {
          const url = new URL(field("openwebui_url").value.trim());
          httpsUrl = url.protocol === "https:" && Boolean(url.hostname);
        } catch { /* The native validator supplies the field error. */ }
        if (!httpsUrl || !present("openwebui_model")) {
          modelMissing = true;
          modelStatus = "add HTTPS URL and model ID";
        }
      }
      const mal = selected("list-source") === "myanimelist";
      // The controller exposes Remove only after a successful in-memory read.
      const historyPresent = mal ? !field("upload-clear").hidden : present("username");
      const scoresOnly = field("skip_profile").checked;
      const planningOnly = field("use_planning").checked;
      const notesPresent = present("profile");
      const tastePresent = scoresOnly || planningOnly || notesPresent;

      write("model", `${labels[provider] || "Provider"}: ${modelStatus}`);
      write("history", mal
        ? `MAL: ${historyPresent ? "export loaded" : "add an export"}`
        : `AniList: ${historyPresent ? "username entered" : "add a username"}`);
      write("taste", scoresOnly ? "Scores only: notes left out"
        : notesPresent ? "Taste notes added"
        : planningOnly ? "Planning list sets the brief" : "Add notes or choose scores only");
      write("scope", planningOnly ? "Menu scope: your Plan to Watch list only."
        : "Menu scope: beyond your Plan to Watch list.");
      const next = modelMissing ? "Model: complete your provider inputs."
        : !historyPresent ? "History: add the list that gives the menu its reference points."
        : !tastePresent ? "Taste: add notes, use scores only, or choose Plan to Watch."
        : "Inputs in place. Cook validates them before sending the request.";
      write("next", next);
      slip.classList.add("has-receipt");
      slip.querySelector(".preparation-slip__footer").hidden = false;
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    // These native UI changes include async export reads and invited-account setup.
    const observer = new MutationObserver(update);
    observer.observe(field("upload-clear"), { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(field("key-status"), { childList: true, characterData: true, subtree: true });
    observer.observe(field("profile-count"), { childList: true, characterData: true, subtree: true });
    observer.observe(field("privacy-receipt-copy"), { childList: true, subtree: true });
    update();
  });
})();
