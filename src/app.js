import { posts, notices, myPosts } from "./data.js";

const USER_POSTS_STORAGE_KEY = "tmi-nearby:userPosts";
const HIDDEN_IDS_STORAGE_KEY = "tmi-nearby:hiddenIds";

let userPosts = loadUserPosts();
let hiddenIds = loadHiddenIds();
let feed = createFeed();
let composeType = "tmi";

const DRAG_THRESHOLD = 100;
let dragState = null;
let isShifting = false;

const COMPOSE_COOLDOWN_MS = 10000;
const BAD_WORDS = ["시발", "씨발", "병신", "개새", "좆", "fuck", "shit"];
const PHONE_PATTERN = /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/;

let lastComposeTime = 0;
let composeWarnTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const cardStack = $("#cardStack");
const feedEmpty = $("#feedEmpty");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function isValidUserPost(post) {
  return post
    && typeof post.id !== "undefined"
    && typeof post.who === "string"
    && typeof post.text === "string"
    && Array.isArray(post.comments)
    && Array.isArray(post.reactions);
}

function loadUserPosts() {
  try {
    const value = localStorage.getItem(USER_POSTS_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidUserPost).sort((a, b) => Number(b.id) - Number(a.id));
  } catch {
    return [];
  }
}

function saveUserPosts() {
  try {
    localStorage.setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(userPosts));
  } catch {
    // localStorage 사용 불가(프라이빗 모드, 용량 초과 등) 시 조용히 무시
  }
}

function loadHiddenIds() {
  try {
    const value = localStorage.getItem(HIDDEN_IDS_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id !== "undefined") : [];
  } catch {
    return [];
  }
}

function saveHiddenIds() {
  try {
    localStorage.setItem(HIDDEN_IDS_STORAGE_KEY, JSON.stringify(hiddenIds));
  } catch {
    // localStorage 사용 불가 시 조용히 무시
  }
}

function createFeed() {
  return [...userPosts, ...posts].filter((post) => !hiddenIds.includes(post.id));
}

function renderFeed() {
  cardStack.innerHTML = "";
  feedEmpty.hidden = feed.length > 0;
  cardStack.hidden = feed.length === 0;

  feed.slice(0, 3).forEach((post, index) => {
    const card = document.createElement("article");
    card.className = "tmi-card";
    card.style.zIndex = String(10 - index);
    card.dataset.id = post.id;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-user">
          <div class="mini-avatar">${post.who.at(-1)}</div>
          <strong>${post.who}</strong>
          <span class="distance">${post.distance}</span>
        </div>
        <button class="more-button" aria-label="게시물 메뉴">⋯</button>
      </div>
      <div class="card-text">${escapeHtml(post.text)}</div>
      ${post.type === "vote" ? voteMarkup(post) : ""}
      <div class="card-bottom">
        <button class="comment-button" data-open-detail="${post.id}">💬 댓글 ${post.comments.length}</button>
        <span class="watching">👀 ${post.watching}명</span>
      </div>
      <div class="swipe-stamp stamp-like" aria-hidden="true">LIKE</div>
      <div class="swipe-stamp stamp-nope" aria-hidden="true">NOPE</div>
    `;
    cardStack.append(card);
  });

  bindCardDrag();
}

function voteMarkup(post) {
  return `
    <div class="vote-options">
      ${post.options.map((option) => `
        <button class="vote-option" style="--pct:${option.pct}%">
          <i class="bar"></i>
          <span>${option.label}</span>
          <b>${option.pct}%</b>
        </button>
      `).join("")}
    </div>
  `;
}

function bindCardDrag() {
  const card = cardStack.firstElementChild;
  if (!card) return;
  card.addEventListener("pointerdown", onDragStart);
}

function onDragStart(event) {
  if (event.button !== 0 || !event.isPrimary) return;
  if (event.target.closest(".more-button, .comment-button, .vote-option, .card-menu")) return;
  const card = event.currentTarget;
  card.setPointerCapture(event.pointerId);
  dragState = { card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dx: 0, moved: false, horizontal: null };
  card.addEventListener("pointermove", onDragMove);
  card.addEventListener("pointerup", onDragEnd);
  card.addEventListener("pointercancel", onDragEnd);
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const dx = event.clientX - dragState.startX;
  const dy = event.clientY - dragState.startY;

  if (dragState.horizontal === null) {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    dragState.horizontal = Math.abs(dx) > Math.abs(dy);
    if (dragState.horizontal) dragState.card.classList.add("is-dragging");
  }
  if (!dragState.horizontal) return;

  event.preventDefault();
  dragState.moved = true;
  dragState.dx = dx;

  const { card } = dragState;
  card.style.transform = `translate(${dx}px, ${dy * 0.35}px) rotate(${dx / 18}deg)`;

  const ratio = Math.min(Math.abs(dx) / DRAG_THRESHOLD, 1);
  card.querySelector(".stamp-like").style.opacity = dx > 0 ? String(ratio) : "0";
  card.querySelector(".stamp-nope").style.opacity = dx < 0 ? String(ratio) : "0";
}

function onDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { card, dx, moved } = dragState;
  card.releasePointerCapture(event.pointerId);
  card.classList.remove("is-dragging");
  card.removeEventListener("pointermove", onDragMove);
  card.removeEventListener("pointerup", onDragEnd);
  card.removeEventListener("pointercancel", onDragEnd);
  dragState = null;

  if (moved && Math.abs(dx) > DRAG_THRESHOLD) {
    shiftCard(dx > 0 ? "like" : "nope", card);
    return;
  }

  card.style.transform = "";
  card.querySelector(".stamp-like").style.opacity = "0";
  card.querySelector(".stamp-nope").style.opacity = "0";
}

function shiftCard(direction = "like", card = $(".tmi-card")) {
  if (!feed.length || isShifting) return;
  isShifting = true;
  if (card) {
    card.style.transform = direction === "like"
      ? "translateX(130px) rotate(12deg)"
      : "translateX(-130px) rotate(-12deg)";
    card.style.opacity = "0";
  }
  setTimeout(() => {
    feed.shift();
    renderFeed();
    updateLiveCount();
    isShifting = false;
  }, 180);
}

function openCardMenu(button) {
  closeCardMenu();
  const card = button.closest(".tmi-card");
  if (!card) return;
  const id = card.dataset.id;

  const menu = document.createElement("div");
  menu.className = "card-menu";
  menu.dataset.cardMenu = "1";
  menu.innerHTML = `
    <button type="button" data-action="hide">숨기기</button>
    <button type="button" data-action="report">신고하기</button>
  `;

  menu.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    event.stopPropagation();
    const action = target.dataset.action;
    closeCardMenu();
    if (action === "hide") hidePost(id);
    else if (action === "report") showToast("신고가 접수됐어요");
  });

  button.parentElement.style.position = "relative";
  button.parentElement.append(menu);
  document.addEventListener("pointerdown", onCardMenuOutside, true);
}

function closeCardMenu() {
  $$(".card-menu").forEach((menu) => menu.remove());
  document.removeEventListener("pointerdown", onCardMenuOutside, true);
}

function onCardMenuOutside(event) {
  if (event.target.closest(".card-menu, .more-button")) return;
  closeCardMenu();
}

function hidePost(id) {
  const postId = Number(id);
  if (!hiddenIds.includes(postId)) {
    hiddenIds.push(postId);
    saveHiddenIds();
  }
  feed = feed.filter((post) => post.id !== postId);
  renderFeed();
}

function showToast(message) {
  const existing = $("#cardToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "cardToast";
  toast.className = "card-toast";
  toast.textContent = message;
  $(".app-screen").append(toast);
  toast.classList.add("is-visible");
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 1600);
}

function updateLiveCount() {
  const live = 17 + Math.floor(Math.random() * 18);
  $("#liveCount").textContent = `${live}명`;
}

function renderNotices() {
  $("#noticeList").innerHTML = notices.map(([icon, text, time]) => `
    <article class="notice-card">
      <div class="notice-icon">${icon}</div>
      <div>
        <strong>${text}</strong>
        <span>${time}</span>
      </div>
    </article>
  `).join("");
}

function sumReactions(reactions) {
  return reactions.reduce((total, reaction) => total + Number(reaction.match(/\d+/)?.[0] ?? 0), 0);
}

function renderMyPosts() {
  const userEntries = userPosts.map((post) => [
    post.type === "vote" ? "투표" : "TMI",
    post.text,
    "방금 전",
    String(sumReactions(post.reactions)),
    String(post.comments.length),
    String(post.watching),
  ]);

  $("#myPosts").innerHTML = [...userEntries, ...myPosts].map(([tag, text, time, hearts, comments, views]) => `
    <article class="post-card">
      <div>
        <span>${tag} · ${time}</span>
        <strong>${escapeHtml(text)}</strong>
        <span>♥ ${hearts} · 💬 ${comments} · 👀 ${views}</span>
      </div>
    </article>
  `).join("");
}

function openDetail(id) {
  const postId = Number(id);
  const post = feed.find((item) => item.id === postId) || userPosts.find((item) => item.id === postId) || posts.find((item) => item.id === postId) || feed[0];
  if (!post) return;
  $("#detailBody").innerHTML = `
    <p class="tiny-label">${post.who} · ${post.distance}</p>
    <h3 id="detailTitle" class="sheet-title">${escapeHtml(post.text)}</h3>
    <div class="reaction-row">${post.reactions.map((reaction) => `<span>${reaction}</span>`).join("")}</div>
    <div class="comment-list">
      ${post.comments.map(([who, text]) => `
        <div class="comment-item">
          <strong>${who}</strong>
          <p>${text}</p>
        </div>
      `).join("")}
    </div>
  `;
  $("#detailSheet").showModal();
}

function openCompose() {
  $("#composeSheet").showModal();
  $("#composeInput").focus();
}

function showComposeWarn(message) {
  const warn = $("#composeWarn");
  warn.textContent = message;
  warn.hidden = false;
  clearTimeout(composeWarnTimer);
  composeWarnTimer = setTimeout(() => { warn.hidden = true; }, 3000);
}

function submitCompose(event) {
  event.preventDefault();
  const value = $("#composeInput").value.trim();
  if (!value) return;

  const now = Date.now();
  const elapsed = now - lastComposeTime;
  if (lastComposeTime && elapsed < COMPOSE_COOLDOWN_MS) {
    showComposeWarn(`잠시 후 다시 시도해주세요 (${Math.ceil((COMPOSE_COOLDOWN_MS - elapsed) / 1000)}초)`);
    return;
  }

  const lower = value.toLowerCase();
  if (BAD_WORDS.some((word) => lower.includes(word))) {
    showComposeWarn("부적절한 표현이 포함되어 있어요. 다시 작성해주세요.");
    return;
  }
  if (PHONE_PATTERN.test(value)) {
    showComposeWarn("전화번호 등 개인정보는 공유할 수 없어요.");
    return;
  }

  lastComposeTime = now;
  const item = {
    id: now,
    type: composeType,
    who: "익명의 라쿤",
    distance: "0m",
    text: value,
    options: composeType === "vote" ? [{ label: "좋다", pct: 55 }, { label: "애매", pct: 45 }] : undefined,
    comments: [["익명의 봇 · 1m", "방금 올라온 따끈한 TMI"]],
    reactions: ["✨ 1"],
    watching: 1,
  };
  feed.unshift(item);
  userPosts.unshift(item);
  saveUserPosts();
  $("#composeInput").value = "";
  $("#composeWarn").hidden = true;
  $("#composeSheet").close();
  renderFeed();
  renderMyPosts();
  switchTab("feed");
}

function switchTab(tab) {
  $$(".tab-button").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  $$(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tab);
  });
  $("#composeButton").style.display = tab === "feed" ? "block" : "none";
}

function bindEvents() {
  $("#likeButton").addEventListener("click", () => shiftCard("like"));
  $("#nopeButton").addEventListener("click", () => shiftCard("nope"));
  $("#resetFeed").addEventListener("click", () => {
    feed = createFeed();
    renderFeed();
  });
  $("#composeButton").addEventListener("click", openCompose);
  $("#submitCompose").addEventListener("click", submitCompose);
  $("#composeInput").addEventListener("input", () => {
    const warn = $("#composeWarn");
    if (!warn.hidden) {
      warn.hidden = true;
      clearTimeout(composeWarnTimer);
    }
  });
  cardStack.addEventListener("click", (event) => {
    const moreButton = event.target.closest(".more-button");
    if (moreButton) {
      event.stopPropagation();
      openCardMenu(moreButton);
      return;
    }
    const target = event.target.closest("[data-open-detail]");
    if (target) openDetail(target.dataset.openDetail);
  });
  $$(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  $$(".type-chip").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      composeType = button.dataset.composeType;
      $$(".type-chip").forEach((chip) => chip.classList.toggle("is-selected", chip === button));
    });
  });
}

renderFeed();
renderNotices();
renderMyPosts();
bindEvents();
