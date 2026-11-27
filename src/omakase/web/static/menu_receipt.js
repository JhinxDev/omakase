/* Read-only preparation slip synchronized with the counter state. */
(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("setup-form");
    const slip = document.querySelector(".tasting-slip");
    if (!form || !slip) return;

    const field = (id) => document.getElementById(id);
    const selected = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value;
    const present = (id) => Boolean(field(id)?.value.trim());

    const labels = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini",
      deepseek: "DeepSeek",
      openrouter: "OpenRouter",
      openwebui: "OpenWebUI",
    };

    const write = (name, text) => {
      document.querySelectorAll(`[data-receipt="${name}"]`).forEach((node) => {
        if (node.textContent !== text) node.textContent = text;
      });
    };

    const markTab = (course, ready) => {
      const btn = document.querySelector(`[data-course-target="${course}"]`);
      if (btn) btn.classList.toggle("is-ready", ready);
    };

    function update() {
      const provider = selected("provider") || "openai";
      const providerLabel = labels[provider] || "Provider";
      const activeModel = field("model")?.value.trim() || "load or enter model";
      const keyPresent = present("api_key");
      let modelMissing = !keyPresent || !present("model");

      if (provider === "openwebui") {
        let httpsUrl = false;
        try {
          const url = new URL(field("openwebui_url").value.trim());
          httpsUrl = url.protocol === "https:" && Boolean(url.hostname);
        } catch {
          httpsUrl = false;
        }
        if (!httpsUrl || !present("openwebui_model")) {
          modelMissing = true;
        }
      }

      const mal = selected("list-source") === "myanimelist";
      const historyPresent = mal ? !field("upload-clear").hidden : present("username");
      const scoresOnly = field("skip_profile").checked;
      const planningOnly = field("use_planning").checked;
      const notesPresent = present("profile");
      const tastePresent = scoresOnly || planningOnly || notesPresent;

      write("model", `${providerLabel} / ${activeModel}`);
      write("model-tab", `${providerLabel} / ${activeModel}`);
      write("key", keyPresent ? "Key pasted (request-local)" : "Not pasted yet");

      const historySummary = mal
        ? `MAL: ${historyPresent ? "export loaded" : "add an export"}`
        : `AniList: ${historyPresent ? field("username").value.trim() : "add a username"}`;
      write("history", historySummary);
      write("history-tab", historySummary);

      const tasteSummary = scoresOnly
        ? "Scores only"
        : notesPresent
          ? "Taste notes added"
          : planningOnly
            ? "Plan to Watch sets scope"
            : "Add notes or choose scores only";
      write("taste", tasteSummary);
      write("taste-tab", tasteSummary);

      write("scope", planningOnly ? "Your Plan to Watch list only" : "Beyond Plan to Watch");

      const next = modelMissing
        ? provider === "openwebui"
          ? "Model: enter HTTPS URL, model ID, and API key."
          : "Model: paste your API key to load live models or continue."
        : !historyPresent
          ? "History: add your AniList handle or MAL export."
          : !tastePresent
            ? "Taste: add notes, use scores only, or limit to Plan to Watch."
            : "Ready to cook. All inputs stay request-local.";
      write("next", next);

      markTab("model", !modelMissing);
      markTab("history", historyPresent);
      markTab("taste", tastePresent);
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("omakase:state-change", update);

    const observer = new MutationObserver(update);
    observer.observe(field("upload-clear"), { attributes: true, attributeFilter: ["hidden"] });
    observer.observe(field("profile-count"), { childList: true, characterData: true, subtree: true });
    update();
  });
})();
