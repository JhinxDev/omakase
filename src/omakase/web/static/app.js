"use strict";

const urlSafety = window.OmakaseUrlSafety;

const PROVIDERS = {
  openai: {
    label: "OpenAI",
    url: "https://api.openai.com",
    fast: "gpt-5-mini",
    pro: "gpt-5",
    hint: "Create or manage a key in your OpenAI account.",
  },
  anthropic: {
    label: "Anthropic",
    url: "https://api.anthropic.com",
    fast: "claude-haiku-4-5",
    pro: "claude-sonnet-4-6",
    hint: "Use a key from your Anthropic Console account.",
  },
  gemini: {
    label: "Gemini",
    url: "https://generativelanguage.googleapis.com",
    fast: "gemini-3.8-flash",
    pro: "gemini-4-hydrogen",
    hint: "Use a Gemini API key from Google AI Studio.",
  },
  deepseek: {
    label: "DeepSeek",
    url: "https://api.deepseek.com",
    fast: "deepseek-v4-flash",
    pro: "deepseek-v4-pro",
    hint: "Use a key from the DeepSeek Platform.",
  },
  openrouter: {
    label: "OpenRouter",
    url: "https://openrouter.ai/api",
    fast: "openai/gpt-5-mini",
    pro: "anthropic/claude-sonnet-4.6",
    hint: "Use an OpenRouter key with access to the selected model.",
  },
  openwebui: {
    label: "OpenWebUI",
    url: "",
    fast: "",
    pro: "",
    hint: "Use an API key created by your OpenWebUI account.",
  },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const COURSE_ORDER = ["model", "history", "taste"];
const LOADING_PHASES = [
  { at: 0, text: "Reading your anime history..." },
  { at: 4, text: "Mapping the patterns in your scores..." },
  { at: 8, text: "Pairing the tasting menu..." },
  { at: 28, text: "The model is taking a closer look..." },
  { at: 65, text: "Still preparing. Deep models can take longer." },
];

let activeCourse = "model";
let malExportB64 = "";
let loadingTimer = null;
let loadingStartedAt = 0;
let requestController = null;
let activeJobId = "";

const byId = (id) => document.getElementById(id);
const errorBannerHome = byId("error-banner").parentElement;
const errorBannerNext = byId("error-banner").nextElementSibling;
let invalidField = null;

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
  field.focus({ preventScroll: true });
  field.closest(".field, .upload-field")?.scrollIntoView({ behavior: "instant", block: "center" });
}

function clearError() {
  byId("error-banner").hidden = true;
  byId("error-text").textContent = "";
  if (invalidField) {
    invalidField.removeAttribute("aria-invalid");
    const descriptions = (invalidField.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== "error-text");
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

function updateProvider() {
  const name = selectedValue("provider") || "openai";
  const provider = PROVIDERS[name];
  const mode = selectedValue("model-mode") || "fast";
  const isOpenWebUI = name === "openwebui";
  byId("llm_type").value = name;
  byId("llm_url").value = isOpenWebUI
    ? byId("openwebui_url").value.trim().replace(/\/+$/, "")
    : provider.url;
  byId("mode").value = isOpenWebUI ? "fast" : mode;
  byId("model_override").disabled = isOpenWebUI;
  byId("mode-field").hidden = isOpenWebUI;
  byId("model-override-fields").hidden = isOpenWebUI;
  document.querySelectorAll(".openwebui-field").forEach((field) => {
    field.hidden = !isOpenWebUI;
  });
  const override = isOpenWebUI
    ? byId("openwebui_model").value.trim()
    : byId("model_override").value.trim();
  byId("model").value = override || provider[mode];
  byId("key-hint").textContent = provider.hint;
  if (!isOpenWebUI) {
    byId("model-hint").textContent = `${mode === "fast" ? "Quick" : "Deep"} currently selects ${provider[mode]}.`;
  }
  byId("api_key").placeholder = "Paste for this request only";
  updateSelectedCards(".choice-card");
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
      showError(
        "Paste the key for the provider you selected.",
        "model",
        "api_key",
      );
      focusInvalidField("api_key");
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

function createText(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
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
    selected.forEach(index => {
      const recommendation = recommendations[index];
      const article = document.createElement("article");
      article.className = "result-menu-comparison__pick";
      article.append(createText("p", "result-menu-label", `Pick ${String(index + 1).padStart(2, "0")}`), createText("h4", "result-menu-comparison__title", recommendation.title));
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
      const link = createText("a", "result-menu-comparison-link", "Read comparison ↑");
      link.href = "#results-comparison-title";
      link.hidden = true;
      link.addEventListener("click", event => {
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
  const sourceLabel = data.source === "myanimelist" ? "MAL export" : "AniList";
  byId("results-meta").textContent = `${sourceLabel} / ${data.recommendations.length} picks`;
  const comparison = createMenuComparison(data.recommendations);

  if (!data.recommendations.length) {
    const empty = createText("p", "empty-state", "The model returned no usable picks. Try Quick mode or another provider.");
    list.appendChild(empty);
  } else {
    data.recommendations.forEach((recommendation, index) => {
      const article = document.createElement("article");
      const coverUrl = urlSafety.safeCoverUrl(recommendation.cover_image);
      article.className = coverUrl ? "recommendation recommendation--with-cover" : "recommendation";
      article.style.setProperty("--result-index", index);

      const number = createText("span", "recommendation__number", String(index + 1).padStart(2, "0"));
      number.setAttribute("aria-label", `Pick ${index + 1}`);
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
      match.append(createText("span", "result-menu-label", "History pairing"), createText("strong", "", recommendationPairing(recommendation)));
      body.appendChild(match);

      const score = document.createElement("div");
      score.className = "recommendation__score";
      const fit = predictedFit(recommendation);
      score.append(createText("span", "result-menu-label", "Predicted fit"), createText("strong", "", fit === null ? "Not provided" : fit), createText("span", "", fit === null ? "" : "/ 10 · model estimate"));

      if (coverUrl) {
        const cover = document.createElement("img");
        cover.className = "recommendation__cover";
        cover.src = coverUrl;
        cover.alt = "";
        cover.loading = "lazy";
        cover.referrerPolicy = "no-referrer";
        cover.addEventListener("error", () => {
          cover.remove();
          article.classList.remove("recommendation--with-cover");
        });
        article.append(number, cover, body, score);
      } else {
        article.append(number, body, score);
      }
      const safeUrl = urlSafety.safeExternalUrl(recommendation.url);
      if (safeUrl) {
        const link = createText("a", "recommendation__link", "Open anime page ↗");
        link.href = safeUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", `Open ${recommendation.title} in a new tab`);
        article.appendChild(link);
      }
      const compareControl = comparison?.addControl(index);
      if (compareControl) article.appendChild(compareControl);
      list.appendChild(article);
    });
  }

  results.hidden = false;
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
  document.querySelectorAll('input[name="provider"], input[name="model-mode"]').forEach((input) => input.addEventListener("change", updateProvider));
  document.querySelectorAll('input[name="list-source"]').forEach((input) => input.addEventListener("change", updateSource));
  byId("model_override").addEventListener("input", updateProvider);
  byId("openwebui_url").addEventListener("input", updateProvider);
  byId("openwebui_model").addEventListener("input", updateProvider);
  byId("skip_profile").addEventListener("change", updateProfileState);
  byId("profile").addEventListener("input", updateWordCount);
  byId("mal_export_file").addEventListener("change", onMalFileSelected);
  byId("upload-clear").addEventListener("click", clearMalFile);
  byId("setup-form").addEventListener("submit", runRecommendations);
  byId("cancel-request").addEventListener("click", cancelActiveRequest);
  byId("start-over").addEventListener("click", startOver);
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
