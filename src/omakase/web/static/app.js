"use strict";

const urlSafety = window.OmakaseUrlSafety;

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    url: "https://api.openai.com",
    hint: "Create or manage an API key in your OpenAI Platform account.",
    publicCatalog: false,
    starters: [
      { id: "gpt-6-luna", name: "GPT-6 Luna", tier: "fast" },
      { id: "gpt-6.2-sol", name: "GPT-6.2 Sol", tier: "balanced" },
      { id: "gpt-6.2-astra", name: "GPT-6.2 Astra", tier: "flagship" },
      { id: "gpt-6.2-astra-pro", name: "GPT-6.2 Astra Pro", tier: "reasoning" },
    ],
  },
  anthropic: {
    label: "Anthropic",
    url: "https://api.anthropic.com",
    hint: "Use an API key from your Anthropic Console account.",
    publicCatalog: false,
    starters: [
      { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", tier: "fast" },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", tier: "balanced" },
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", tier: "flagship" },
      { id: "claude-fable-5-2", name: "Claude Fable 5.2", tier: "reasoning" },
    ],
  },
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com",
    hint: "Use a Gemini API key from Google AI Studio.",
    publicCatalog: false,
    starters: [
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", tier: "fast" },
      { id: "gemini-4-hydrogen", name: "Gemini 4 Hydrogen", tier: "balanced" },
      { id: "gemini-4-neon", name: "Gemini 4 Neon", tier: "reasoning" },
      { id: "gemini-4-carbon", name: "Gemini 4 Carbon", tier: "flagship" },
    ],
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com",
    hint: "Use an API key from the DeepSeek Platform.",
    publicCatalog: false,
    starters: [
      { id: "deepseek-flash", name: "DeepSeek Flash", tier: "fast" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", tier: "reasoning" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api",
    hint: "Browse OpenRouter models anytime; paste a key to verify and cook.",
    publicCatalog: true,
    starters: [
      { id: "openai/gpt-6.2-sol", name: "OpenAI: GPT-6.2 Sol", tier: "balanced" },
      { id: "anthropic/claude-sonnet-5.5", name: "Anthropic: Claude Sonnet 5.5", tier: "balanced" },
      { id: "google/gemini-4-hydrogen", name: "Google: Gemini 4 Hydrogen", tier: "balanced" },
      { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek: DeepSeek V4.1 Flash", tier: "fast" },
      { id: "openai/gpt-6.2-astra", name: "OpenAI: GPT-6.2 Astra", tier: "flagship" },
      { id: "google/gemini-4-neon", name: "Google: Gemini 4 Neon", tier: "reasoning" },
    ],
  },
  openwebui: {
    label: "OpenWebUI",
    url: "",
    hint: "Enter an owner-approved HTTPS instance URL and your OpenWebUI API key.",
    publicCatalog: false,
    starters: [],
  },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const COURSE_ORDER = ["model", "history", "taste"];
const LOADING_PHASES = [
  { at: 0, text: "Reading your anime history..." },
  { at: 4, text: "Mapping the patterns in your scores..." },
  { at: 8, text: "Pairing the tasting menu..." },
  { at: 28, text: "The model is taking a closer look..." },
  { at: 65, text: "Still preparing. Reasoning models can take longer." },
];

let activeCourse = "model";
let malExportB64 = "";
let loadingTimer = null;
let loadingStartedAt = 0;
let requestController = null;
let activeJobId = "";
let invalidField = null;
let lastRecommendations = [];

const providerCache = new Map();
let activeTier = "all";
let searchQuery = "";
let selectedModelsByProvider = new Map();
let openrouterAutoRequested = false;

const byId = (id) => document.getElementById(id);
const errorBannerHome = byId("error-banner").parentElement;
const errorBannerNext = byId("error-banner").nextElementSibling;

function showCourse(name, focusHeading = true) {
  if (!COURSE_ORDER.includes(name)) return;
  activeCourse = name;
  document.querySelectorAll("[data-course]").forEach((panel) => {
    const selected = panel.dataset.course === name;
    panel.hidden = !selected;
    panel.classList.toggle("is-active", selected);
  });
  document.querySelectorAll("[data-course-target]").forEach((button) => {
    const selected = button.dataset.courseTarget === name;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  if (focusHeading) {
    const heading = document.querySelector(`[data-course="${name}"] h3`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: "instant", block: "start" });
  }
}

function showError(message, course = activeCourse, fieldId = null) {
  clearError();
  if (course !== activeCourse) showCourse(course, false);
  const banner = byId("error-banner");
  const field = fieldId ? byId(fieldId) : null;
  const fieldGroup = field?.closest(".field, .upload-field");
  if (fieldGroup) fieldGroup.prepend(banner);
  else errorBannerHome.insertBefore(banner, errorBannerNext);
  byId("error-text").textContent = message;
  banner.hidden = false;
  if (field) {
    invalidField = field;
    field.setAttribute("aria-invalid", "true");
    const descriptions = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    descriptions.add("error-text");
    field.setAttribute("aria-describedby", [...descriptions].join(" "));
    if (fieldGroup?.matches(".upload-field")) focusInvalidField(fieldId);
  } else {
    banner.focus({ preventScroll: true });
    banner.scrollIntoView({ behavior: "instant", block: "center" });
  }
}

function focusInvalidField(id) {
  const field = byId(id);
  field?.focus({ preventScroll: true });
  field?.closest(".field, .upload-field")?.scrollIntoView({ behavior: "instant", block: "center" });
}

function clearError() {
  byId("error-banner").hidden = true;
  byId("error-text").textContent = "";
  if (invalidField) {
    invalidField.setAttribute("aria-invalid", "false");
    const descriptions = (invalidField.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== "error-text");
    if (descriptions.length) invalidField.setAttribute("aria-describedby", descriptions.join(" "));
    else invalidField.removeAttribute("aria-describedby");
    invalidField = null;
  }
}

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function updateSelectedCards(selector) {
  document.querySelectorAll(selector).forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("is-selected", Boolean(input?.checked));
  });
}

function currentProviderCatalog(name) {
  const cached = providerCache.get(name);
  if (cached && Array.isArray(cached.models)) return cached;
  const provider = PROVIDERS[name] || PROVIDERS.openai;
  return {
    source: "starter",
    key_verified: false,
    models: provider.starters,
    error: "",
  };
}

function formatContextLength(tokens) {
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M ctx`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k ctx`;
  return `${tokens} ctx`;
}

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function syncResolvedModel() {
  const name = selectedValue("provider") || "openai";
  const provider = PROVIDERS[name] || PROVIDERS.openai;
  const isOpenWebUI = name === "openwebui";
  const catalog = currentProviderCatalog(name);
  const models = catalog.models || [];

  const chosenId =
    selectedModelsByProvider.get(name) ||
    models[0]?.id ||
    provider.starters[0]?.id ||
    "";

  const override = isOpenWebUI
    ? byId("openwebui_model").value.trim()
    : byId("model_override").value.trim();

  const resolvedModel = override || chosenId;
  const matchedEntry = models.find((m) => m.id === resolvedModel);
  const resolvedTier = matchedEntry?.tier || "balanced";

  byId("llm_type").value = name;
  byId("llm_url").value = isOpenWebUI
    ? byId("openwebui_url").value.trim().replace(/\/+$/, "")
    : provider.url;
  byId("model").value = resolvedModel;
  byId("mode").value = resolvedTier === "reasoning" || resolvedTier === "flagship" ? "pro" : "fast";

  if (!isOpenWebUI) {
    byId("clear-model-override").hidden = !override;
    byId("model-hint").textContent = resolvedModel
      ? `Active model: ${resolvedModel}`
      : "Enter a model ID or choose one from the list above.";
  }

  byId("setup-form").dispatchEvent(new Event("omakase:state-change"));
}

function renderModelExplorer() {
  const name = selectedValue("provider") || "openai";
  const provider = PROVIDERS[name] || PROVIDERS.openai;
  const isOpenWebUI = name === "openwebui";
  const catalog = currentProviderCatalog(name);
  const allModels = catalog.models || [];

  const statusNode = byId("model-fetch-status");
  if (catalog.loading) {
    statusNode.dataset.tone = "loading";
    statusNode.textContent = `Loading ${provider.label} models...`;
  } else if (catalog.error) {
    statusNode.dataset.tone = "error";
    statusNode.textContent = catalog.error;
  } else if (catalog.source === "live" && catalog.key_verified) {
    statusNode.dataset.tone = "verified";
    statusNode.textContent = `Key verified. ${allModels.length} live models loaded.`;
  } else if (catalog.source === "live_public") {
    statusNode.dataset.tone = "verified";
    statusNode.textContent = `${allModels.length} live public models loaded. Paste key to cook.`;
  } else if (isOpenWebUI) {
    statusNode.dataset.tone = "starter";
    statusNode.textContent = "Enter your HTTPS URL and key, then load models.";
  } else {
    statusNode.dataset.tone = "starter";
    statusNode.textContent = "Starter picks. Paste your key to load your live catalog.";
  }

  const hasFree = allModels.some((m) => Boolean(m.is_free));
  const freePill = document.querySelector('.tier-pill[data-tier="free"]');
  if (freePill) {
    freePill.hidden = !hasFree;
    if (!hasFree && activeTier === "free") activeTier = "all";
  }

  document.querySelectorAll(".tier-pill").forEach((pill) => {
    pill.setAttribute("aria-pressed", String(pill.dataset.tier === activeTier));
  });

  const searchWrap = byId("model-search-wrap");
  searchWrap.hidden = allModels.length <= 5;
  if (searchWrap.hidden && searchQuery) {
    searchQuery = "";
    byId("model-search").value = "";
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = allModels.filter((item) => {
    if (activeTier === "free" && !item.is_free) return false;
    if (activeTier === "reasoning" && item.tier !== "reasoning" && item.tier !== "flagship") {
      return false;
    }
    if (activeTier === "fast" && item.tier !== "fast") return false;
    if (activeTier === "balanced" && item.tier !== "balanced") return false;
    if (!normalizedQuery) return true;
    return (
      String(item.id || "").toLowerCase().includes(normalizedQuery) ||
      String(item.name || "").toLowerCase().includes(normalizedQuery)
    );
  });

  let activeSelectedId = selectedModelsByProvider.get(name);
  if (!activeSelectedId || !allModels.some((m) => m.id === activeSelectedId)) {
    activeSelectedId = allModels[0]?.id || "";
    if (activeSelectedId) selectedModelsByProvider.set(name, activeSelectedId);
  }

  const list = byId("model-list");
  list.replaceChildren();

  if (!filtered.length) {
    const emptyText = allModels.length
      ? "No models match this filter. Clear the search or enter a custom model ID below."
      : "No preset models for OpenWebUI. Load from your instance or enter a model ID above.";
    list.appendChild(createText("p", "model-empty", emptyText));
  } else {
    filtered.forEach((item) => {
      const label = document.createElement("label");
      const checked = item.id === activeSelectedId;
      label.className = checked ? "model-option is-selected" : "model-option";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "selected-model";
      radio.value = item.id;
      radio.checked = checked;
      radio.addEventListener("change", () => {
        selectedModelsByProvider.set(name, item.id);
        if (isOpenWebUI) byId("openwebui_model").value = item.id;
        else byId("model_override").value = "";
        updateSelectedCards(".model-option");
        syncResolvedModel();
      });

      const title = createText("span", "model-option__name", item.name || item.id);
      const meta = document.createElement("span");
      meta.className = "model-option__meta";
      const tierLabel = item.tier === "flagship" ? "Flagship" : item.tier || "Balanced";
      meta.appendChild(createText("span", `tier-badge tier-badge--${item.tier || "balanced"}`, tierLabel));
      if (item.is_free) {
        meta.appendChild(createText("span", "tier-badge tier-badge--free", "Free"));
      }
      const ctxLabel = formatContextLength(item.context_length);
      if (ctxLabel) {
        meta.appendChild(createText("span", "tier-badge", ctxLabel));
      }
      const idLine = createText("span", "model-option__id", item.id);

      label.append(radio, title, meta, idLine);
      list.appendChild(label);
    });
  }

  syncResolvedModel();
}

function updateProvider() {
  const name = selectedValue("provider") || "openai";
  const provider = PROVIDERS[name] || PROVIDERS.openai;
  const isOpenWebUI = name === "openwebui";

  byId("model_override").disabled = isOpenWebUI;
  byId("model-override-fields").hidden = isOpenWebUI;
  document.querySelectorAll(".openwebui-field").forEach((field) => {
    field.hidden = !isOpenWebUI;
  });

  byId("key-hint").textContent = provider.hint;
  byId("api_key").placeholder = "Paste for this request only";
  updateSelectedCards(".choice-card");
  renderModelExplorer();

  if (name === "openrouter" && !providerCache.has("openrouter") && !openrouterAutoRequested) {
    openrouterAutoRequested = true;
    loadProviderModels({ quiet: true });
  }
}

async function loadProviderModels({ quiet = false } = {}) {
  const name = selectedValue("provider") || "openai";
  const provider = PROVIDERS[name] || PROVIDERS.openai;
  const isOpenWebUI = name === "openwebui";
  const apiKey = byId("api_key").value.trim();
  const customUrl = isOpenWebUI ? byId("openwebui_url").value.trim() : provider.url;

  if (isOpenWebUI) {
    let parsed;
    try {
      parsed = new URL(customUrl);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== "https:" || !parsed.hostname) {
      if (!quiet) showError("Enter the HTTPS URL for your OpenWebUI instance first.", "model", "openwebui_url");
      return;
    }
  }

  if (!provider.publicCatalog && !apiKey) {
    if (!quiet) showError(`Paste your ${provider.label} API key to load live models.`, "model", "api_key");
    return;
  }

  clearError();
  providerCache.set(name, {
    ...currentProviderCatalog(name),
    loading: true,
    error: "",
  });
  renderModelExplorer();

  const btn = byId("fetch-models-btn");
  btn.disabled = true;

  try {
    const response = await fetch("/api/providers/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        llm_type: name,
        llm_url: customUrl,
        api_key: apiKey,
      }),
    });
    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.detail || `Could not load ${provider.label} models.`);
    }
    const models = Array.isArray(data.models) && data.models.length
      ? data.models
      : provider.starters;
    providerCache.set(name, {
      source: data.source || "live",
      key_verified: Boolean(data.key_verified),
      models,
      loading: false,
      error: "",
    });
    if (isOpenWebUI && models.length && !byId("openwebui_model").value.trim()) {
      byId("openwebui_model").value = models[0].id;
    }
  } catch (error) {
    const existing = currentProviderCatalog(name);
    providerCache.set(name, {
      source: existing.source === "live" ? "starter" : existing.source,
      key_verified: false,
      models: existing.models.length ? existing.models : provider.starters,
      loading: false,
      error: error.message || `Could not load ${provider.label} models.`,
    });
  } finally {
    btn.disabled = false;
    renderModelExplorer();
  }
}

function updateSource() {
  const source = selectedValue("list-source") || "anilist";
  byId("source").value = source;
  byId("anilist-inputs").hidden = source !== "anilist";
  byId("mal-inputs").hidden = source !== "myanimelist";
  document.querySelectorAll(".source-switch label").forEach((label) => {
    label.classList.toggle("is-selected", Boolean(label.querySelector("input")?.checked));
  });
  if (source === "anilist") clearMalFile();
}

function updateProfileState() {
  const skip = byId("skip_profile").checked;
  byId("profile-field").hidden = skip;
  if (!skip) updateWordCount();
}

function updateWordCount() {
  const words = byId("profile").value.trim().split(/\s+/).filter(Boolean).length;
  byId("profile-count").textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function validateCourse(name) {
  if (name === "model") {
    const provider = byId("llm_type").value;
    if (provider === "openwebui") {
      let instanceUrl;
      try {
        instanceUrl = new URL(byId("openwebui_url").value.trim());
      } catch {
        instanceUrl = null;
      }
      if (!instanceUrl || instanceUrl.protocol !== "https:" || !instanceUrl.hostname) {
        showError("Enter the HTTPS URL for your OpenWebUI instance.", "model", "openwebui_url");
        focusInvalidField("openwebui_url");
        return false;
      }
      if (!byId("openwebui_model").value.trim()) {
        showError("Enter the model ID exactly as it appears in OpenWebUI.", "model", "openwebui_model");
        focusInvalidField("openwebui_model");
        return false;
      }
    }
    if (!byId("api_key").value.trim()) {
      showError("Paste the key for the provider you selected.", "model", "api_key");
      focusInvalidField("api_key");
      return false;
    }
    if (!byId("model").value.trim()) {
      showError("Select a model or enter a model ID to continue.", "model", "model_override");
      focusInvalidField("model_override");
      return false;
    }
  }
  if (name === "history") {
    const source = byId("source").value;
    if (source === "anilist" && !byId("username").value.trim()) {
      showError("Enter the public AniList username whose scores should guide the menu.", "history", "username");
      focusInvalidField("username");
      return false;
    }
    if (source === "myanimelist" && !malExportB64) {
      showError("Choose a MyAnimeList Anime export before continuing.", "history", "mal_export_file");
      focusInvalidField("mal_export_file");
      return false;
    }
  }
  if (name === "taste") {
    const skip = byId("skip_profile").checked;
    const planOnly = byId("use_planning").checked;
    if (!skip && !planOnly && !byId("profile").value.trim()) {
      showError("Add a few taste notes, choose scores only, or limit the menu to Plan to Watch.", "taste", "profile");
      focusInvalidField("profile");
      return false;
    }
  }
  clearError();
  return true;
}

function navigateToCourse(target) {
  const currentIndex = COURSE_ORDER.indexOf(activeCourse);
  const targetIndex = COURSE_ORDER.indexOf(target);
  if (targetIndex > currentIndex && !validateCourse(activeCourse)) return;
  showCourse(target);
}

function onMalFileSelected() {
  const input = byId("mal_export_file");
  const file = input.files?.[0];
  if (!file) {
    clearMalFile();
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    showError("That file is larger than 10 MB. Check that you selected an Anime export.", "history", "mal_export_file");
    clearMalFile();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    const comma = result.indexOf(",");
    malExportB64 = comma >= 0 ? result.slice(comma + 1) : "";
    byId("upload-trigger-label").textContent = `${file.name} is ready`;
    byId("upload-clear").hidden = false;
    clearError();
  };
  reader.onerror = () => {
    showError("Omakase could not read that export. Choose the file again.", "history", "mal_export_file");
    clearMalFile();
  };
  reader.readAsDataURL(file);
}

function clearMalFile() {
  malExportB64 = "";
  if (byId("mal_export_file")) byId("mal_export_file").value = "";
  if (byId("upload-trigger-label")) byId("upload-trigger-label").textContent = "Choose your MAL export";
  if (byId("upload-clear")) byId("upload-clear").hidden = true;
}

function renderLoading() {
  const elapsed = Math.floor((Date.now() - loadingStartedAt) / 1000);
  const phase = LOADING_PHASES.filter((item) => elapsed >= item.at).at(-1) || LOADING_PHASES[0];
  byId("loading-text").textContent = phase.text;
  byId("loading-elapsed").textContent = `${elapsed}s`;
}

function setLoading(active) {
  const loading = byId("loading");
  const form = byId("setup-form");
  loading.hidden = !active;
  form.hidden = active;
  byId("run-btn").disabled = active;
  byId("start-over").disabled = active;
  byId("results").setAttribute("aria-busy", String(active));
  if (active) {
    const providerLabel = (PROVIDERS[byId("llm_type").value] || PROVIDERS.openai).label;
    byId("loading-model-label").textContent = `${providerLabel} / ${byId("model").value}`;
    loadingStartedAt = Date.now();
    renderLoading();
    loadingTimer = window.setInterval(renderLoading, 1000);
    byId("cancel-request").focus({ preventScroll: true });
  } else {
    window.clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

function buildPayload() {
  const skipProfile = byId("skip_profile").checked;
  return {
    llm_type: byId("llm_type").value,
    llm_url: byId("llm_url").value,
    api_key: byId("api_key").value,
    model: byId("model").value,
    source: byId("source").value,
    username: byId("source").value === "anilist" ? byId("username").value.trim() : "",
    profile: skipProfile ? "" : byId("profile").value,
    mode: byId("mode").value,
    use_planning: byId("use_planning").checked,
    skip_profile: skipProfile,
    mal_export_b64: malExportB64,
    mal_client_id: "",
  };
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      response.status >= 500
        ? "The recommendation service was interrupted. Please try again."
        : "Omakase received an unexpected response. Please try again.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Omakase received an incomplete response. Please try again.");
  }
}

function abortableDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

async function pollRecommendationJob(jobId, signal) {
  while (true) {
    await abortableDelay(1200, signal);
    const response = await fetch(`/api/recommend/jobs/${encodeURIComponent(jobId)}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.detail || "Omakase lost track of this menu.");
    if (data.status === "done") return data;
    if (data.status === "error") {
      throw new Error(data.detail || "Omakase could not finish this menu.");
    }
    if (data.status === "cancelled") throw new DOMException("Aborted", "AbortError");
  }
}

async function runRecommendations(event) {
  event.preventDefault();
  for (const course of COURSE_ORDER) {
    if (!validateCourse(course)) return;
  }

  requestController = new AbortController();
  setLoading(true);
  byId("results").hidden = true;
  try {
    const response = await fetch("/api/recommend/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(buildPayload()),
      signal: requestController.signal,
    });
    const receipt = await readApiResponse(response);
    if (!response.ok) throw new Error(receipt.detail || "Omakase could not start this menu.");
    activeJobId = receipt.job_id;
    const data = await pollRecommendationJob(activeJobId, requestController.signal);
    displayResults(data);
    byId("api_key").value = "";
    byId("api_key").dispatchEvent(new Event("input", { bubbles: true }));
  } catch (error) {
    if (error.name === "AbortError") showError("The menu was cancelled.", "taste");
    else showError(error.message || "Omakase could not finish this menu.", "taste");
  } finally {
    activeJobId = "";
    requestController = null;
    setLoading(false);
    const outcome = !byId("error-banner").hidden
      ? byId("error-banner")
      : !byId("results").hidden ? byId("results-title") : null;
    if (outcome) {
      outcome.setAttribute("tabindex", "-1");
      outcome.focus({ preventScroll: true });
      outcome.scrollIntoView({ behavior: "instant", block: outcome.id === "results-title" ? "start" : "center" });
    }
  }
}

function predictedFit(recommendation) {
  const value = recommendation.predicted_score;
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : null;
}

function recommendationReason(recommendation) {
  return recommendation.reasoning || "The model did not include a reason for this pick.";
}

function recommendationPairing(recommendation) {
  return recommendation.best_match_from_history || "No history pairing provided.";
}

function createMenuComparison(recommendations) {
  const panel = byId("results-comparison");
  if (!panel) return null;
  const list = byId("results-comparison-list");
  const status = byId("results-compare-status");
  const selected = new Set();
  const controls = new Map();
  panel.hidden = true;
  list.replaceChildren();
  status.parentElement.hidden = recommendations.length < 2;
  byId("results-compare-help").hidden = recommendations.length < 2;
  status.textContent = recommendations.length < 2 ? "" : "No picks selected for comparison.";

  function update() {
    panel.hidden = selected.size === 0;
    status.textContent = selected.size === 0
      ? "No picks selected for comparison."
      : `${selected.size} of 2 picks selected. ${selected.size === 1 ? "Choose another pick to compare." : "Your comparison is ready."}`;
    controls.forEach(({ button, link }, index) => {
      const active = selected.has(index);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = active ? "Remove from comparison" : "Compare this pick";
      button.setAttribute("aria-label", `${active ? "Remove" : "Compare"} ${recommendations[index].title}${active ? " from comparison" : ""}`);
      button.disabled = !active && selected.size === 2;
      link.hidden = !active;
    });
    list.replaceChildren();
    selected.forEach((index) => {
      const recommendation = recommendations[index];
      const article = document.createElement("article");
      article.className = "result-menu-comparison__pick";
      article.append(
        createText("p", "result-menu-label", `Pick ${String(index + 1).padStart(2, "0")}`),
        createText("h4", "result-menu-comparison__title", recommendation.title),
      );
      const details = document.createElement("dl");
      const fit = predictedFit(recommendation);
      [
        ["Why this pick", recommendationReason(recommendation)],
        ["History pairing", recommendationPairing(recommendation)],
        ["Predicted fit", fit === null ? "Not provided" : `${fit} / 10 (model estimate)`],
      ].forEach(([label, value]) => details.append(createText("dt", "result-menu-label", label), createText("dd", "", value)));
      article.appendChild(details);
      const remove = createText("button", "result-menu-button", "Remove this pick");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${recommendation.title} from comparison`);
      remove.addEventListener("click", () => {
        selected.delete(index);
        update();
        controls.get(index).button.focus();
      });
      article.appendChild(remove);
      list.appendChild(article);
    });
  }

  byId("results-compare-clear").onclick = () => {
    const first = selected.values().next().value;
    selected.clear();
    update();
    if (first !== undefined) controls.get(first).button.focus();
  };

  return {
    addControl(index) {
      if (recommendations.length < 2) return null;
      const recommendation = recommendations[index];
      const group = document.createElement("div");
      group.className = "recommendation__compare";
      const button = createText("button", "result-menu-button", "Compare this pick");
      button.type = "button";
      button.setAttribute("aria-label", `Compare ${recommendation.title}`);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-controls", "results-comparison");
      button.setAttribute("aria-describedby", "results-compare-help results-compare-status");
      const link = createText("a", "result-menu-comparison-link", "Read comparison");
      link.href = "#results-comparison-title";
      link.hidden = true;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const heading = byId("results-comparison-title");
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ behavior: "instant", block: "start" });
      });
      controls.set(index, { button, link });
      button.addEventListener("click", () => {
        if (selected.has(index)) selected.delete(index);
        else if (selected.size < 2) selected.add(index);
        update();
      });
      group.append(button, link);
      return group;
    },
  };
}

function buildMetaStrip(recommendation) {
  const badges = [];
  if (typeof recommendation.format === "string" && recommendation.format.trim()) {
    badges.push({ text: recommendation.format.trim(), isGenre: false });
  }
  if (Number.isInteger(recommendation.episodes) && recommendation.episodes > 0) {
    const unit = recommendation.episodes === 1 ? "ep" : "eps";
    badges.push({ text: `${recommendation.episodes} ${unit}`, isGenre: false });
  }
  if (typeof recommendation.studio === "string" && recommendation.studio.trim()) {
    badges.push({ text: recommendation.studio.trim(), isGenre: false });
  }
  if (Array.isArray(recommendation.genres)) {
    recommendation.genres.slice(0, 3).forEach((genre) => {
      if (typeof genre === "string" && genre.trim()) {
        badges.push({ text: genre.trim(), isGenre: true });
      }
    });
  }
  if (!badges.length) return null;
  const strip = document.createElement("div");
  strip.className = "recommendation__meta";
  badges.forEach(({ text, isGenre }) => {
    strip.appendChild(
      createText(
        "span",
        isGenre ? "recommendation__badge recommendation__badge--genre" : "recommendation__badge",
        text,
      ),
    );
  });
  return strip;
}

function displayResults(data) {
  const results = byId("results");
  const list = byId("results-list");
  list.replaceChildren();
  lastRecommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  byId("copy-menu-btn").hidden = lastRecommendations.length === 0;
  byId("copy-menu-label").textContent = "Copy menu";

  const sourceLabel = data.source === "myanimelist" ? "MAL export" : "AniList";
  const activeModel = byId("model").value;
  byId("results-meta").textContent = `${sourceLabel} / ${lastRecommendations.length} picks / ${activeModel}`;
  const comparison = createMenuComparison(lastRecommendations);

  if (!lastRecommendations.length) {
    const empty = createText("p", "empty-state", "The model returned no usable picks. Try another model or adjust your taste notes.");
    list.appendChild(empty);
  } else {
    lastRecommendations.forEach((recommendation, index) => {
      const article = document.createElement("article");
      const coverUrl = urlSafety.safeCoverUrl(recommendation.cover_image);
      const bannerUrl = urlSafety.safeCoverUrl(recommendation.banner_image);
      article.className = "recommendation";

      const banner = document.createElement("div");
      banner.className = "recommendation__banner";
      const backdropSrc = bannerUrl || coverUrl;
      if (backdropSrc) {
        const bannerImg = document.createElement("img");
        bannerImg.className = bannerUrl
          ? "recommendation__banner-img"
          : "recommendation__banner-img recommendation__banner-img--soft";
        bannerImg.src = backdropSrc;
        bannerImg.alt = "";
        bannerImg.loading = "lazy";
        bannerImg.referrerPolicy = "no-referrer";
        bannerImg.addEventListener("error", () => {
          bannerImg.remove();
        });
        banner.appendChild(bannerImg);
      }

      const bannerScrim = document.createElement("div");
      bannerScrim.className = "recommendation__banner-scrim";
      bannerScrim.setAttribute("aria-hidden", "true");
      banner.appendChild(bannerScrim);

      const number = createText("span", "recommendation__number", String(index + 1).padStart(2, "0"));
      number.setAttribute("aria-label", `Pick ${index + 1}`);

      const score = document.createElement("div");
      score.className = "recommendation__score";
      const fit = predictedFit(recommendation);
      score.append(
        createText("span", "result-menu-label", "Predicted fit"),
        createText("strong", "", fit === null ? "Not provided" : fit),
        createText("span", "recommendation__score-unit", fit === null ? "" : "/ 10"),
      );
      banner.append(number, score);
      article.appendChild(banner);

      const content = document.createElement("div");
      content.className = "recommendation__content";

      const posterFrame = document.createElement("div");
      posterFrame.className = "recommendation__poster";
      if (coverUrl) {
        const cover = document.createElement("img");
        cover.className = "recommendation__cover";
        cover.src = coverUrl;
        cover.alt = `${recommendation.title} poster`;
        cover.loading = "lazy";
        cover.referrerPolicy = "no-referrer";
        cover.addEventListener("error", () => {
          cover.remove();
          posterFrame.classList.add("recommendation__poster--fallback");
          posterFrame.appendChild(
            createText("span", "", (recommendation.title || "?").trim().charAt(0).toUpperCase()),
          );
        });
        posterFrame.appendChild(cover);
      } else {
        posterFrame.classList.add("recommendation__poster--fallback");
        posterFrame.setAttribute("aria-hidden", "true");
        posterFrame.appendChild(
          createText("span", "", (recommendation.title || "?").trim().charAt(0).toUpperCase()),
        );
      }

      const body = document.createElement("div");
      body.className = "recommendation__body";
      body.appendChild(createText("h3", "recommendation__title", recommendation.title));
      const metaStrip = buildMetaStrip(recommendation);
      if (metaStrip) body.appendChild(metaStrip);
      body.append(
        createText("p", "result-menu-label", "Why this pick"),
        createText("p", "recommendation__reason", recommendationReason(recommendation)),
      );
      const match = document.createElement("p");
      match.className = "recommendation__match";
      match.append(
        createText("span", "result-menu-label", "History pairing"),
        createText("strong", "", recommendationPairing(recommendation)),
      );
      body.appendChild(match);

      const actions = document.createElement("div");
      actions.className = "recommendation__actions";
      const safeUrl = urlSafety.safeExternalUrl(recommendation.url);
      if (safeUrl) {
        const link = createText("a", "recommendation__link", "Open anime page");
        link.href = safeUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open ${recommendation.title} in a new tab`);
        actions.appendChild(link);
      }
      const compareControl = comparison?.addControl(index);
      if (compareControl) actions.appendChild(compareControl);
      if (actions.childNodes.length) body.appendChild(actions);

      content.append(posterFrame, body);
      article.appendChild(content);
      list.appendChild(article);
    });
  }

  results.hidden = false;
}

async function copyMenuToClipboard() {
  if (!lastRecommendations.length) return;
  const lines = [
    `# Omakase Tasting Menu (${byId("model").value})`,
    "",
    ...lastRecommendations.map((rec, i) => {
      const fit = predictedFit(rec);
      const fitText = fit === null ? "" : ` (${fit}/10)`;
      const pairing = recommendationPairing(rec);
      return `${i + 1}. **${rec.title}**${fitText}\n   - Why: ${recommendationReason(rec)}\n   - Paired with: ${pairing}`;
    }),
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    byId("copy-menu-label").textContent = "Copied";
    window.setTimeout(() => {
      byId("copy-menu-label").textContent = "Copy menu";
    }, 2000);
  } catch {
    byId("copy-menu-label").textContent = "Copy failed";
  }
}

async function cancelActiveRequest() {
  if (activeJobId) {
    fetch(`/api/recommend/jobs/${encodeURIComponent(activeJobId)}`, {
      method: "DELETE",
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  }
  requestController?.abort();
}

function startOver() {
  byId("results").hidden = true;
  showCourse("model", false);
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  byId("counter").scrollIntoView({ behavior, block: "start" });
  byId("api_key").focus({ preventScroll: true });
}

function bindEvents() {
  document.querySelectorAll("[data-course-target]").forEach((button) => {
    button.addEventListener("click", () => navigateToCourse(button.dataset.courseTarget));
  });
  document.querySelectorAll("[data-next-course]").forEach((button) => {
    button.addEventListener("click", () => navigateToCourse(button.dataset.nextCourse));
  });

  document.querySelectorAll('input[name="provider"]').forEach((input) => {
    input.addEventListener("change", () => {
      activeTier = "all";
      searchQuery = "";
      byId("model-search").value = "";
      clearError();
      updateProvider();
    });
  });

  document.querySelectorAll(".tier-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeTier = pill.dataset.tier || "all";
      renderModelExplorer();
    });
  });

  byId("model-search").addEventListener("input", (event) => {
    searchQuery = event.target.value || "";
    renderModelExplorer();
  });

  byId("fetch-models-btn").addEventListener("click", () => {
    loadProviderModels({ quiet: false });
  });

  byId("api_key").addEventListener("paste", () => {
    window.setTimeout(() => {
      if (byId("api_key").value.trim().length >= 8) {
        loadProviderModels({ quiet: true });
      }
    }, 20);
  });

  byId("api_key").addEventListener("input", () => {
    if (invalidField === byId("api_key") && byId("api_key").value.trim()) {
      clearError();
    }
  });

  byId("model_override").addEventListener("input", () => {
    syncResolvedModel();
    if (invalidField === byId("model_override") && byId("model").value.trim()) {
      clearError();
    }
  });

  byId("clear-model-override").addEventListener("click", () => {
    byId("model_override").value = "";
    syncResolvedModel();
  });

  byId("openwebui_url").addEventListener("input", () => {
    syncResolvedModel();
    if (invalidField === byId("openwebui_url")) clearError();
  });

  byId("openwebui_model").addEventListener("input", () => {
    syncResolvedModel();
    if (invalidField === byId("openwebui_model") && byId("openwebui_model").value.trim()) {
      clearError();
    }
  });

  document.querySelectorAll('input[name="list-source"]').forEach((input) => {
    input.addEventListener("change", () => {
      clearError();
      updateSource();
    });
  });

  byId("username").addEventListener("input", () => {
    if (invalidField === byId("username") && byId("username").value.trim()) {
      clearError();
    }
  });

  byId("skip_profile").addEventListener("change", updateProfileState);
  byId("profile").addEventListener("input", () => {
    updateWordCount();
    if (invalidField === byId("profile") && byId("profile").value.trim()) {
      clearError();
    }
  });

  document.querySelectorAll("[data-taste-chip]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const box = byId("profile");
      if (byId("skip_profile").checked) {
        byId("skip_profile").checked = false;
        updateProfileState();
      }
      const line = chip.dataset.tasteChip || "";
      const existing = box.value.trim();
      if (!existing.includes(line)) {
        box.value = existing ? `${existing}\n- ${line}` : `- ${line}`;
        box.dispatchEvent(new Event("input", { bubbles: true }));
      }
      box.focus();
    });
  });

  byId("mal_export_file").addEventListener("change", onMalFileSelected);
  byId("upload-clear").addEventListener("click", clearMalFile);
  byId("setup-form").addEventListener("submit", runRecommendations);
  byId("cancel-request").addEventListener("click", cancelActiveRequest);
  byId("start-over").addEventListener("click", startOver);
  byId("copy-menu-btn").addEventListener("click", copyMenuToClipboard);

  byId("toggle-key").addEventListener("click", () => {
    const key = byId("api_key");
    const reveal = key.classList.contains("masked-credential");
    key.classList.toggle("masked-credential", !reveal);
    byId("toggle-key").textContent = reveal ? "Hide" : "Show";
    byId("toggle-key").setAttribute("aria-pressed", String(reveal));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  updateProvider();
  updateSource();
  updateProfileState();
  showCourse("model", false);
});
