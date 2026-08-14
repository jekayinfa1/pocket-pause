const STORAGE_KEY = "pocketpause:v1";

const DEFAULT_STATE = {
  version: 1,
  settings: {
    goalName: "Emergency fund",
    goalTarget: 5000,
    baseSaved: 850,
    monthlyGoal: 300,
    hourlyRate: 25,
    tone: "witty",
    pauseHours: 24
  },
  interventions: [],
  rules: [
    { id: "rule-late-scroll", name: "Late-night scroll shield", mood: "any", location: "online", minAmount: 20, message: "The algorithm wants a conversion. Your goal wants the money.", enabled: true, createdAt: new Date().toISOString() },
    { id: "rule-stress", name: "Stress-spend interruption", mood: "stressed", location: "any", minAmount: 1, message: "Solve the feeling first. The cart can wait.", enabled: true, createdAt: new Date().toISOString() }
  ],
  zones: [],
  notificationLog: []
};

const CATEGORY = {
  food: { label: "Food & drinks", emoji: "🍔" }, clothes: { label: "Clothes", emoji: "👟" }, tech: { label: "Tech", emoji: "📱" }, entertainment: { label: "Entertainment", emoji: "🎟️" }, beauty: { label: "Beauty & self-care", emoji: "✨" }, home: { label: "Home", emoji: "🛋️" }, travel: { label: "Travel", emoji: "✈️" }, other: { label: "Other", emoji: "🛒" }
};
const MOOD = {
  bored: { label: "Bored", emoji: "😶" }, stressed: { label: "Stressed", emoji: "😵‍💫" }, excited: { label: "Excited", emoji: "🤩" }, social: { label: "Social", emoji: "🥳" }, tired: { label: "Tired", emoji: "😴" }, neutral: { label: "Neutral", emoji: "🙂" }
};
const LOCATION = { online: "Online", store: "In a store", restaurant: "Food spot", social: "With people", home: "At home", other: "Elsewhere" };
const TONE_COPY = {
  gentle: { lead: "You do not have to decide this second.", close: "Give the feeling a little room, then choose what supports you." },
  witty: { lead: "Your cart has a persuasive closing argument.", close: "Your savings goal would like equal time before the verdict." },
  roast: { lead: "Respectfully, your debit card did not volunteer for this side quest.", close: "Close the tab before free shipping becomes expensive shipping." }
};
const MOOD_LINES = {
  bored: "Boredom is asking for novelty, not necessarily this purchase.",
  stressed: "Stress is looking for fast relief, but the statement arrives after the relief is gone.",
  excited: "Excitement makes urgency feel like evidence. It is not.",
  social: "The people around you will not be responsible for your balance later.",
  tired: "A tired brain prefers the fast reward and postpones the math.",
  neutral: "A neutral moment is a good time to check whether this is useful or simply available."
};
const LOCATION_LINES = {
  online: "The screen removed the friction on purpose. Add some back.",
  store: "Holding it makes it feel owned already. You can still put it back.",
  restaurant: "Convenience is real, but so is the goal you picked.",
  social: "Group energy can make somebody else’s choice feel like your need.",
  home: "The recommendation engine knows when you are comfortable and scrolling.",
  other: "The place is part of the trigger. Notice it before paying."
};
const TEMPTATION_LINES = {
  want: "Wanting it is valid; buying it immediately is optional.",
  sale: "A discount only saves money when the purchase was already necessary.",
  reward: "You deserve a reward that does not punish tomorrow.",
  friends: "Belonging is not a line item you have to buy.",
  convenience: "Convenience has a price. Decide whether this one earns it.",
  replace: "A real replacement can be intentional—compare, wait, and buy the right one."
};

let state = loadState();
let currentIntervention = null;
let historyFilter = "all";
let pendingConfirm = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));
function uid(prefix = "id") { return globalThis.crypto?.randomUUID ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function safeNumber(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return clone(DEFAULT_STATE);
    return {
      ...clone(DEFAULT_STATE), ...parsed,
      settings: { ...clone(DEFAULT_STATE.settings), ...(parsed.settings || {}) },
      interventions: Array.isArray(parsed.interventions) ? parsed.interventions : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : clone(DEFAULT_STATE.rules),
      zones: Array.isArray(parsed.zones) ? parsed.zones : [],
      notificationLog: Array.isArray(parsed.notificationLog) ? parsed.notificationLog : []
    };
  } catch { return clone(DEFAULT_STATE); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function currency(value, maximumFractionDigits = 0) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits }).format(safeNumber(value)); }
function dateTime(value) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function relativeDue(value) { const ms = new Date(value).getTime() - Date.now(); const hours = Math.round(Math.abs(ms) / 36e5); if (ms <= 0) return hours < 1 ? "ready now" : `${hours}h overdue`; if (hours < 1) return "in less than an hour"; return `in ${hours}h`; }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
function isThisMonth(value) { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); }
function skippedInterventions() { return state.interventions.filter(item => item.decision === "skipped"); }
function pausedInterventions() { return state.interventions.filter(item => item.decision === "paused"); }
function protectedTotal() { return skippedInterventions().reduce((sum, item) => sum + safeNumber(item.amount), 0); }
function currentGoalSaved() { return safeNumber(state.settings.baseSaved) + protectedTotal(); }
function monthlyProtected() { return skippedInterventions().filter(item => isThisMonth(item.decidedAt || item.createdAt)).reduce((sum, item) => sum + safeNumber(item.amount), 0); }

function computeStreak() {
  const days = new Set(skippedInterventions().map(item => { const date = new Date(item.decidedAt || item.createdAt); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }));
  if (!days.size) return 0;
  let cursor = new Date();
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function groupBy(items, key) { return items.reduce((groups, item) => { const value = item[key] || "other"; groups[value] ||= { count: 0, amount: 0 }; groups[value].count += 1; groups[value].amount += safeNumber(item.amount); return groups; }, {}); }
function topGroup(items, key, metric = "count") { return Object.entries(groupBy(items, key)).sort((a, b) => b[1][metric] - a[1][metric])[0] || null; }

function showView(name, options = {}) {
  const safeName = ["home", "pause", "result", "reminders", "insights", "history", "settings"].includes(name) ? name : "home";
  $$(".view").forEach(view => view.classList.toggle("active", view.dataset.view === safeName));
  $$(".nav-button").forEach(button => button.classList.toggle("active", button.dataset.navTarget === safeName || (safeName === "history" && button.dataset.navTarget === "home")));
  if (options.updateHash !== false) window.history.replaceState(null, "", `#${safeName}`);
  if (safeName === "pause") { $("#pauseForm").reset(); $("#toneInput").value = state.settings.tone; $("#locationStatus").textContent = ""; $("#amountInput").focus(); }
  if (safeName === "settings") populateSettings();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function toast(message) { const node = document.createElement("div"); node.className = "toast"; node.textContent = message; $("#toastRegion").append(node); setTimeout(() => node.remove(), 4200); }
function categoryLabel(value) { return CATEGORY[value]?.label || "Other"; }
function moodLabel(value) { return MOOD[value]?.label || "Neutral"; }
function decisionLabel(decision) { return ({ skipped: "Protected", paused: "Paused", bought: "Intentional" })[decision] || "Open"; }
function decisionIcon(item) { return CATEGORY[item.category]?.emoji || "🛒"; }

function decisionItemHtml(item, { allowRevisit = false } = {}) {
  const status = item.decision || "open";
  const amountPrefix = status === "skipped" ? "+" : status === "bought" ? "−" : "";
  const action = allowRevisit && status === "paused" ? `<button class="revisit-button" data-revisit-id="${escapeHtml(item.id)}" type="button">Revisit</button>` : "";
  return `<div class="decision-item"><span class="decision-icon" aria-hidden="true">${decisionIcon(item)}</span><div class="decision-body"><strong>${escapeHtml(categoryLabel(item.category))} · ${escapeHtml(moodLabel(item.mood))}</strong><p>${escapeHtml(item.message || "A conscious spending decision")} · ${dateTime(item.createdAt)}</p><span class="status-pill ${escapeHtml(status)}">${decisionLabel(status)}</span></div><div class="decision-amount">${amountPrefix}${currency(item.amount, 2)}${action}</div></div>`;
}

function renderDashboard() {
  const saved = currentGoalSaved();
  const target = Math.max(1, safeNumber(state.settings.goalTarget, 1));
  const percent = Math.min(100, Math.max(0, (saved / target) * 100));
  const remaining = Math.max(0, target - saved);
  const monthly = monthlyProtected();
  const monthlyGoal = safeNumber(state.settings.monthlyGoal);
  const streak = computeStreak();
  const paused = pausedInterventions();
  const topMood = topGroup(state.interventions, "mood");
  $("#goalName").textContent = state.settings.goalName;
  $("#goalPercent").textContent = `${Math.round(percent)}%`;
  $("#goalSaved").textContent = currency(saved);
  $("#goalTarget").textContent = currency(target);
  $("#goalRemaining").textContent = remaining > 0 ? `${currency(remaining)} remaining` : "Goal reached";
  $("#goalForecast").textContent = monthly > 0 ? `${currency(monthly)} protected this month` : "Keep protecting purchases";
  $("#goalRing").style.setProperty("--progress", `${percent * 3.6}deg`);
  $("#goalRing").setAttribute("aria-label", `${Math.round(percent)} percent of ${state.settings.goalName} complete`);
  $("#monthlySaved").textContent = currency(monthly);
  $("#monthlyGoalText").textContent = `of ${currency(monthlyGoal)} monthly target`;
  $("#streakCount").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
  $("#pausedCount").textContent = String(paused.length);
  $("#topTrigger").textContent = topMood ? moodLabel(topMood[0]) : "Learning…";
  $("#topTriggerDetail").textContent = topMood ? `${topMood[1].count} recorded ${topMood[1].count === 1 ? "pause" : "pauses"}` : "Log a few pauses";
  const recent = [...state.interventions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  $("#recentList").innerHTML = recent.length ? recent.map(item => decisionItemHtml(item, { allowRevisit: true })).join("") : `<div class="empty-state"><span>🪴</span><strong>Your first pause starts the pattern.</strong><p>Log a purchase before checkout to see it here.</p></div>`;
  const topCategory = topGroup(state.interventions, "category");
  let nextMove;
  if (paused.length) {
    const next = [...paused].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
    nextMove = `<div class="next-move-card"><strong>Revisit ${currency(next.amount, 2)} ${relativeDue(next.dueAt)}</strong><p>Your ${categoryLabel(next.category).toLowerCase()} purchase is cooling off. Check whether the urge still feels the same.</p><button class="secondary-button revisit-button" data-revisit-id="${escapeHtml(next.id)}" type="button">Open decision</button></div>`;
  } else if (topCategory) {
    nextMove = `<div class="next-move-card"><strong>Watch ${categoryLabel(topCategory[0]).toLowerCase()} spending</strong><p>It appears most often in your pause history. Add a reminder rule for that context before the next checkout.</p><button class="secondary-button" data-nav-target="reminders" type="button">Create a rule</button></div>`;
  } else {
    nextMove = `<div class="next-move-card"><strong>Catch the next impulse early</strong><p>Open PocketPause as soon as you notice the urge. The useful signal is the context before the payment.</p><button class="secondary-button" data-nav-target="pause" type="button">Start a pause</button></div>`;
  }
  $("#nextMove").innerHTML = nextMove;
}

function hashSeed(text) { let value = 0; for (const char of text) value = ((value << 5) - value + char.charCodeAt(0)) | 0; return Math.abs(value); }
function matchingRule(context) { return state.rules.find(rule => rule.enabled && safeNumber(context.amount) >= safeNumber(rule.minAmount) && (rule.mood === "any" || rule.mood === context.mood) && (rule.location === "any" || rule.location === context.location)); }
function makeIntervention(context) {
  const seed = hashSeed(`${context.category}:${context.mood}:${context.location}:${context.tone}:${Math.round(context.amount)}`);
  const category = CATEGORY[context.category] || CATEGORY.other;
  const remaining = Math.max(0, safeNumber(state.settings.goalTarget) - currentGoalSaved());
  const goalShare = remaining > 0 ? (context.amount / remaining) * 100 : 0;
  const workHours = context.amount / Math.max(1, safeNumber(state.settings.hourlyRate, 1));
  const weekly = context.amount * 52;
  const tone = TONE_COPY[context.tone] || TONE_COPY.witty;
  const headlines = {
    gentle: ["You can want it and still wait.", "A pause is also a decision.", "Future you gets a vote."],
    witty: ["Your cart has entered the chat.", "Free shipping is doing expensive work.", "Plot twist: the sale is not a deadline."],
    roast: ["Your debit card asked for witness protection.", "The cart is confident. The budget is concerned.", "That checkout button is not your life coach."]
  };
  const captions = [`${currency(context.amount, 2)} can stay assigned to ${state.settings.goalName}.`, `${workHours.toFixed(1)} hours of work is asking for a 24-hour review.`, `One weekly repeat would become ${currency(weekly)} in a year.`];
  const rule = matchingRule(context);
  return {
    ...context, id: uid("pause"), createdAt: new Date().toISOString(), decision: "open",
    meme: { emoji: category.emoji, headline: headlines[context.tone]?.[seed % headlines[context.tone].length] || headlines.witty[0], caption: captions[(seed >> 2) % captions.length] },
    message: `${tone.lead} ${MOOD_LINES[context.mood]} ${LOCATION_LINES[context.location]} ${TEMPTATION_LINES[context.temptation]} ${tone.close}`,
    impact: { goalShare, workHours, weekly }, matchedRuleId: rule?.id || null, matchedRuleMessage: rule?.message || null
  };
}
function renderResult(item) {
  $("#memeEmoji").textContent = item.meme.emoji;
  $("#memeHeadline").textContent = item.meme.headline;
  $("#memeCaption").textContent = item.meme.caption;
  $("#resultMessage").textContent = item.message;
  $("#impactGrid").innerHTML = `<div class="impact-item"><strong>${currency(item.amount, 2)}</strong><span>can remain protected</span></div><div class="impact-item"><strong>${item.impact.workHours.toFixed(1)}h</strong><span>of take-home work</span></div><div class="impact-item"><strong>${item.impact.goalShare.toFixed(1)}%</strong><span>of the remaining goal</span></div>`;
  const ruleBox = $("#matchedRule");
  if (item.matchedRuleMessage) { ruleBox.hidden = false; ruleBox.textContent = `Your reminder rule says: “${item.matchedRuleMessage}”`; } else { ruleBox.hidden = true; ruleBox.textContent = ""; }
}
function beginIntervention(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const amount = safeNumber(form.get("amount"));
  if (amount <= 0) { toast("Enter a purchase amount greater than zero."); return; }
  currentIntervention = makeIntervention({ amount, category: String(form.get("category")), mood: String(form.get("mood")), location: String(form.get("location")), temptation: String(form.get("temptation")), tone: String(form.get("tone")), note: String(form.get("note") || "").trim() });
  renderResult(currentIntervention);
  showView("result");
}
function finalizeCurrent(decision) {
  if (!currentIntervention) return;
  const now = new Date().toISOString();
  const existingIndex = state.interventions.findIndex(item => item.id === currentIntervention.id);
  const next = { ...currentIntervention, decision, decidedAt: now, dueAt: decision === "paused" ? new Date(Date.now() + safeNumber(state.settings.pauseHours, 24) * 36e5).toISOString() : null };
  if (existingIndex >= 0) state.interventions[existingIndex] = next; else state.interventions.push(next);
  saveState();
  if (decision === "skipped") toast(`${currency(next.amount, 2)} protected for ${state.settings.goalName}.`);
  if (decision === "paused") toast(`Decision paused for ${state.settings.pauseHours} hours.`);
  if (decision === "bought") toast("Logged as an intentional purchase—without shame.");
  currentIntervention = null;
  showView(decision === "paused" ? "reminders" : "home");
}
function revisit(id) {
  const item = state.interventions.find(candidate => candidate.id === id);
  if (!item) return;
  const regenerated = makeIntervention(item);
  currentIntervention = { ...item, decision: "open", impact: item.impact || regenerated.impact, meme: item.meme || regenerated.meme };
  renderResult(currentIntervention);
  showView("result");
}

function renderRules() {
  $("#rulesList").innerHTML = state.rules.length ? state.rules.map(rule => `<div class="rule-item"><label class="switch" title="${rule.enabled ? "Disable" : "Enable"} ${escapeHtml(rule.name)}"><input type="checkbox" data-rule-toggle="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span aria-hidden="true"></span></label><div class="rule-copy"><strong>${escapeHtml(rule.name)}</strong><p>${escapeHtml(rule.message)}</p><div class="rule-meta"><span class="meta-chip">${rule.mood === "any" ? "Any mood" : moodLabel(rule.mood)}</span><span class="meta-chip">${rule.location === "any" ? "Anywhere" : LOCATION[rule.location]}</span><span class="meta-chip">${currency(rule.minAmount)}+</span></div></div><button class="delete-small" data-delete-rule="${escapeHtml(rule.id)}" type="button">Delete</button></div>`).join("") : `<div class="empty-state"><span>🔔</span><strong>No reminder rules yet.</strong><p>Add one for a context that tends to trigger spending.</p></div>`;
  const paused = [...pausedInterventions()].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  $("#pausedList").innerHTML = paused.length ? paused.map(item => decisionItemHtml(item, { allowRevisit: true })).join("") : `<div class="empty-state"><span>🧊</span><strong>No purchases are cooling off.</strong><p>Choose “wait” during an intervention to add one.</p></div>`;
  $("#zonesList").innerHTML = state.zones.length ? state.zones.map(zone => `<div class="zone-item"><span aria-hidden="true">📍</span><div><strong>${escapeHtml(zone.name)}</strong><small>${safeNumber(zone.radius)} m local radius</small></div><button class="delete-small" data-delete-zone="${escapeHtml(zone.id)}" type="button">Delete</button></div>`).join("") : `<div class="empty-state"><span>🗺️</span><strong>No temptation zones saved.</strong><p>Add one while you are physically at the place.</p></div>`;
}
function addRule(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.rules.unshift({ id: uid("rule"), name: String(form.get("name")).trim(), mood: String(form.get("mood")), location: String(form.get("location")), minAmount: Math.max(0, safeNumber(form.get("minAmount"))), message: String(form.get("message")).trim(), enabled: true, createdAt: new Date().toISOString() });
  saveState(); event.currentTarget.reset(); renderRules(); toast("Reminder rule added.");
}
function requestPosition() { return new Promise((resolve, reject) => { if (!navigator.geolocation) return reject(new Error("Geolocation is not supported by this browser.")); navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(error.message || "Location permission was not granted.")), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }); }); }
function distanceMeters(a, b) { const radius = 6371e3; const phi1 = a.latitude * Math.PI / 180; const phi2 = b.latitude * Math.PI / 180; const deltaPhi = (b.latitude - a.latitude) * Math.PI / 180; const deltaLambda = (b.longitude - a.longitude) * Math.PI / 180; const h = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2; return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
async function checkNearbyZones() {
  const status = $("#locationStatus"); status.textContent = "Checking your location…";
  try {
    const position = await requestPosition();
    const matches = state.zones.map(zone => ({ zone, distance: distanceMeters(position.coords, zone) })).filter(item => item.distance <= safeNumber(item.zone.radius)).sort((a, b) => a.distance - b.distance);
    if (matches.length) { const match = matches[0]; status.textContent = `You are near ${match.zone.name} (${Math.round(match.distance)} m). Pause before spending.`; toast(`Temptation zone: ${match.zone.name}. Your savings goal is nearby too.`); }
    else status.textContent = state.zones.length ? "No saved temptation zone is nearby." : "Location checked. Add temptation zones from Reminders.";
  } catch (error) { status.textContent = error.message; }
}
async function addZone(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget); const button = event.currentTarget.querySelector("button"); button.disabled = true; button.textContent = "Locating…";
  try {
    const position = await requestPosition();
    state.zones.unshift({ id: uid("zone"), name: String(form.get("name")).trim(), radius: safeNumber(form.get("radius"), 250), latitude: position.coords.latitude, longitude: position.coords.longitude, createdAt: new Date().toISOString() });
    saveState(); event.currentTarget.reset(); renderRules(); toast("Temptation zone saved on this device.");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = "Save my current location"; }
}
async function enableNotifications() {
  if (!("Notification" in window)) { toast("This browser does not support notifications."); return; }
  const permission = await Notification.requestPermission(); toast(permission === "granted" ? "Notifications enabled while PocketPause is active." : "Notification permission was not granted."); renderNotificationButton();
}
function renderNotificationButton() {
  const button = $("#enableNotificationsButton");
  if (!("Notification" in window)) { button.textContent = "Notifications unsupported"; button.disabled = true; return; }
  button.textContent = Notification.permission === "granted" ? "Notifications enabled" : "Enable notifications";
}
function notify(title, body, tag) {
  toast(`${title}: ${body}`);
  if ("Notification" in window && Notification.permission === "granted") navigator.serviceWorker?.ready.then(registration => registration.showNotification(title, { body, tag, icon: "./assets/icon.svg", badge: "./assets/icon.svg" })).catch(() => new Notification(title, { body, tag }));
}
function checkDuePauses() {
  const now = Date.now();
  for (const item of pausedInterventions()) {
    if (!item.dueAt || new Date(item.dueAt).getTime() > now) continue;
    const logKey = `due:${item.id}`;
    if (state.notificationLog.includes(logKey)) continue;
    state.notificationLog.push(logKey);
    notify("Your pause is ready", `${currency(item.amount, 2)} for ${categoryLabel(item.category)} has cooled off. Do you still want it?`, logKey);
  }
  state.notificationLog = state.notificationLog.slice(-100); saveState();
}

function renderInsights() {
  const all = state.interventions; const skipped = skippedInterventions(); const total = protectedTotal(); const success = all.length ? (skipped.length / all.length) * 100 : 0; const expensiveMood = topGroup(all, "mood", "amount"); const average = skipped.length ? total / skipped.length : 0;
  $("#totalProtected").textContent = currency(total); $("#successRate").textContent = `${Math.round(success)}%`; $("#expensiveTrigger").textContent = expensiveMood ? moodLabel(expensiveMood[0]) : "—"; $("#expensiveTriggerDetail").textContent = expensiveMood ? `${currency(expensiveMood[1].amount)} considered` : "No data yet"; $("#averageProtected").textContent = currency(average);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); const end = new Date(date); end.setDate(end.getDate() + 1);
    const amount = skipped.filter(item => { const value = new Date(item.decidedAt || item.createdAt); return value >= date && value < end; }).reduce((sum, item) => sum + safeNumber(item.amount), 0);
    return { date, amount };
  });
  const max = Math.max(1, ...days.map(day => day.amount));
  $("#weeklyChart").innerHTML = days.map(day => `<div class="bar-column" aria-label="${day.date.toLocaleDateString(undefined, { weekday: "long" })}: ${currency(day.amount)}"><span class="bar-value">${day.amount ? currency(day.amount) : ""}</span><div class="bar" style="height:${Math.max(3, (day.amount / max) * 190)}px"></div><span class="bar-label">${day.date.toLocaleDateString(undefined, { weekday: "short" })}</span></div>`).join("");
  const topMood = topGroup(all, "mood"); const topCategory = topGroup(all, "category");
  $("#insightNarrative").innerHTML = all.length ? `<div class="insight-callout"><span aria-hidden="true">${MOOD[topMood[0]]?.emoji || "🧠"}</span><h3>${moodLabel(topMood[0])} is your most common recorded mood.</h3><p>${topCategory ? `${categoryLabel(topCategory[0])} appears most often.` : ""} You have protected ${currency(total)} across ${skipped.length} skipped ${skipped.length === 1 ? "purchase" : "purchases"}. Use this as a cue, not a label: place a reminder where that context begins.</p></div>` : `<div class="empty-state"><span>📊</span><strong>Your patterns will appear here.</strong><p>Complete a few spending pauses to make the insight useful.</p></div>`;
  renderBreakdown("#moodBreakdown", groupBy(all, "mood"), moodLabel); renderBreakdown("#categoryBreakdown", groupBy(all, "category"), categoryLabel);
}
function renderBreakdown(selector, groups, labeler) {
  const entries = Object.entries(groups).sort((a, b) => b[1].count - a[1].count); const max = Math.max(1, ...entries.map(([, value]) => value.count));
  $(selector).innerHTML = entries.length ? entries.map(([key, value]) => `<div class="breakdown-row"><strong>${escapeHtml(labeler(key))}</strong><div class="breakdown-track"><div class="breakdown-fill" style="width:${(value.count / max) * 100}%"></div></div><span>${value.count}</span></div>`).join("") : `<div class="empty-state"><span>○</span><strong>No data yet</strong><p>Your first pause starts this chart.</p></div>`;
}
function renderHistory() {
  let items = [...state.interventions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (historyFilter !== "all") items = items.filter(item => item.decision === historyFilter);
  $("#historyList").innerHTML = items.length ? items.map(item => decisionItemHtml(item, { allowRevisit: true })).join("") : `<div class="empty-state"><span>🧾</span><strong>No matching decisions.</strong><p>Try another filter or start a new pause.</p></div>`;
}
function populateSettings() {
  $("#settingsGoalName").value = state.settings.goalName; $("#settingsGoalTarget").value = state.settings.goalTarget; $("#settingsBaseSaved").value = state.settings.baseSaved; $("#settingsMonthlyGoal").value = state.settings.monthlyGoal; $("#settingsHourlyRate").value = state.settings.hourlyRate; $("#settingsTone").value = state.settings.tone; $("#settingsPauseHours").value = String(state.settings.pauseHours);
}
function saveSettings(event) {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  state.settings = { goalName: String(form.get("goalName")).trim() || "Savings goal", goalTarget: Math.max(1, safeNumber(form.get("goalTarget"), 1)), baseSaved: Math.max(0, safeNumber(form.get("baseSaved"))), monthlyGoal: Math.max(0, safeNumber(form.get("monthlyGoal"))), hourlyRate: Math.max(1, safeNumber(form.get("hourlyRate"), 1)), tone: String(form.get("tone")), pauseHours: Math.max(1, safeNumber(form.get("pauseHours"), 24)) };
  saveState(); $("#toneInput").value = state.settings.tone; toast("Settings saved."); renderAll();
}
function exportData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "PocketPause", data: state }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `pocketpause-export-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); toast("Your local data export is ready.");
}
function confirmAction({ title, text, confirmLabel = "Confirm", action }) { pendingConfirm = action; $("#dialogTitle").textContent = title; $("#dialogText").textContent = text; $("#dialogConfirmButton").textContent = confirmLabel; $("#confirmDialog").showModal(); }
function resetData() {
  confirmAction({ title: "Erase all local PocketPause data?", text: "This removes settings, pause history, reminder rules, and temptation zones from this browser. It cannot be undone.", confirmLabel: "Erase everything", action: () => { state = clone(DEFAULT_STATE); saveState(); currentIntervention = null; renderAll(); populateSettings(); toast("Local data erased."); showView("home"); } });
}
function loadDemoData() {
  const now = Date.now();
  state.interventions = [
    { amount: 42, category: "clothes", mood: "bored", location: "online", temptation: "sale", tone: "witty", decision: "skipped", offset: 0 },
    { amount: 18.5, category: "food", mood: "tired", location: "restaurant", temptation: "convenience", tone: "gentle", decision: "skipped", offset: 1 },
    { amount: 119, category: "tech", mood: "excited", location: "online", temptation: "want", tone: "roast", decision: "paused", offset: 0 },
    { amount: 27, category: "beauty", mood: "social", location: "store", temptation: "friends", tone: "witty", decision: "bought", offset: 3 },
    { amount: 64, category: "home", mood: "stressed", location: "online", temptation: "reward", tone: "gentle", decision: "skipped", offset: 4 },
    { amount: 15, category: "food", mood: "bored", location: "home", temptation: "convenience", tone: "witty", decision: "skipped", offset: 6 }
  ].map(entry => { const createdAt = new Date(now - entry.offset * 864e5); const item = makeIntervention(entry); return { ...item, decision: entry.decision, createdAt: createdAt.toISOString(), decidedAt: new Date(createdAt.getTime() + 5 * 60e3).toISOString(), dueAt: entry.decision === "paused" ? new Date(now + 6 * 36e5).toISOString() : null }; });
  saveState(); renderAll(); toast("Fictional demo data loaded."); showView("home");
}
async function shareApp() {
  const data = { title: "PocketPause", text: "A private, context-aware pause before impulse spending.", url: location.href.split("#")[0] };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); toast("App link copied."); } } catch (error) { if (error.name !== "AbortError") toast("Sharing was not available."); }
}
function renderAll() { renderDashboard(); renderRules(); renderInsights(); renderHistory(); renderNotificationButton(); }
function bindEvents() {
  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-nav-target]"); if (nav) showView(nav.dataset.navTarget);
    const revisitButton = event.target.closest("[data-revisit-id]"); if (revisitButton) revisit(revisitButton.dataset.revisitId);
    const deleteRule = event.target.closest("[data-delete-rule]"); if (deleteRule) { state.rules = state.rules.filter(rule => rule.id !== deleteRule.dataset.deleteRule); saveState(); renderRules(); toast("Rule deleted."); }
    const deleteZone = event.target.closest("[data-delete-zone]"); if (deleteZone) { state.zones = state.zones.filter(zone => zone.id !== deleteZone.dataset.deleteZone); saveState(); renderRules(); toast("Zone deleted."); }
    const filter = event.target.closest("[data-history-filter]"); if (filter) { historyFilter = filter.dataset.historyFilter; $$(".filter-button").forEach(button => button.classList.toggle("active", button === filter)); renderHistory(); }
  });
  document.addEventListener("change", event => { const toggle = event.target.closest("[data-rule-toggle]"); if (!toggle) return; const rule = state.rules.find(item => item.id === toggle.dataset.ruleToggle); if (rule) rule.enabled = toggle.checked; saveState(); renderRules(); });
  $("#newPauseButton").addEventListener("click", () => showView("pause"));
  $("#settingsShortcut").addEventListener("click", () => showView("settings"));
  $("#pauseForm").addEventListener("submit", beginIntervention);
  $("#skipPurchaseButton").addEventListener("click", () => finalizeCurrent("skipped"));
  $("#pausePurchaseButton").addEventListener("click", () => finalizeCurrent("paused"));
  $("#intentionalPurchaseButton").addEventListener("click", () => finalizeCurrent("bought"));
  $("#checkLocationButton").addEventListener("click", checkNearbyZones);
  $("#ruleForm").addEventListener("submit", addRule);
  $("#zoneForm").addEventListener("submit", addZone);
  $("#enableNotificationsButton").addEventListener("click", enableNotifications);
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#exportButton").addEventListener("click", exportData);
  $("#settingsExportButton").addEventListener("click", exportData);
  $("#demoDataButton").addEventListener("click", loadDemoData);
  $("#resetDataButton").addEventListener("click", resetData);
  $("#shareButton").addEventListener("click", shareApp);
  $("#confirmDialog").addEventListener("close", () => { if ($("#confirmDialog").returnValue === "confirm" && pendingConfirm) pendingConfirm(); pendingConfirm = null; });
}
async function registerServiceWorker() { if (!("serviceWorker" in navigator)) return; try { await navigator.serviceWorker.register("./sw.js"); } catch (error) { console.warn("PocketPause service worker registration failed", error); } }
function initialize() { bindEvents(); $("#toneInput").value = state.settings.tone; renderAll(); const requested = location.hash.replace("#", ""); showView(requested || "home", { updateHash: false }); checkDuePauses(); setInterval(checkDuePauses, 30000); registerServiceWorker(); }
initialize();
