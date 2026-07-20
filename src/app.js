import { posts, notices, myPosts } from "./data.js";
import { getCurrentPosition, haversineDistanceMeters, formatDistanceMeters, assignNearbyCoordinate } from "./geo.js";
import {
  escapeHtml,
  isValidUserPost,
  sumReactions,
  getComposeCooldownRemainingMs,
  containsBadWord,
  containsPhoneNumber,
  containsLocationHint,
  getCommentReportId,
} from "./utils.js";

const USER_POSTS_STORAGE_KEY = "tmi-nearby:userPosts";
const HIDDEN_IDS_STORAGE_KEY = "tmi-nearby:hiddenIds";
const BLOCKED_AUTHORS_STORAGE_KEY = "tmi-nearby:blockedAuthors";
const REPORTED_IDS_STORAGE_KEY = "tmi-nearby:reportedIds";
const REPORTED_COMMENTS_STORAGE_KEY = "tmi-nearby:reportedComments";
const REPORTED_AUTHORS_STORAGE_KEY = "tmi-nearby:reportedAuthors";
const VOTED_OPTIONS_STORAGE_KEY = "tmi-nearby:votedOptions";
const NICKNAME_STORAGE_KEY = "tmi-nearby:nickname";
const NICKNAME_TTL_MS = 24 * 60 * 60 * 1000;
const NICKNAME_CANDIDATES = ["라쿤", "사과", "고양이", "복숭아", "너구리", "두더지", "라임", "새우", "밤", "별", "연필", "봄"];

function createArrayStorage(storageKey, isValidItem) {
  return {
    load() {
      try {
        const value = localStorage.getItem(storageKey);
        const parsed = value ? JSON.parse(value) : [];
        return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
      } catch {
        return [];
      }
    },
    save(list) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // localStorage 사용 불가 시 조용히 무시
      }
    },
  };
}

const hiddenIdsStorage = createArrayStorage(HIDDEN_IDS_STORAGE_KEY, (id) => typeof id !== "undefined");
const blockedAuthorsStorage = createArrayStorage(BLOCKED_AUTHORS_STORAGE_KEY, (a) => typeof a === "string");
const reportedIdsStorage = createArrayStorage(REPORTED_IDS_STORAGE_KEY, (id) => typeof id !== "undefined");
const reportedCommentsStorage = createArrayStorage(REPORTED_COMMENTS_STORAGE_KEY, (id) => typeof id === "string");
const reportedAuthorsStorage = createArrayStorage(REPORTED_AUTHORS_STORAGE_KEY, (author) => typeof author === "string");
const votedOptionsStorage = createArrayStorage(
  VOTED_OPTIONS_STORAGE_KEY,
  (entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "number" && typeof entry[1] === "number",
);
const userPostsStorage = createArrayStorage(USER_POSTS_STORAGE_KEY, isValidUserPost);

let userPosts = loadUserPosts();
let hiddenIds = hiddenIdsStorage.load();
let blockedAuthors = blockedAuthorsStorage.load();
let reportedIds = reportedIdsStorage.load();
let reportedComments = reportedCommentsStorage.load();
let reportedAuthors = reportedAuthorsStorage.load();
let currentNickname = `익명의 ${resolveNickname()}`;
let feed = createFeed();
let composeType = "tmi";
let activeDetailPost = null;
let votedOptions = new Map(votedOptionsStorage.load());

const DRAG_THRESHOLD = 100;
let dragState = null;
let isShifting = false;

const NEARBY_RADIUS_METERS = 50;

const COMPOSE_COOLDOWN_MS = 10000;
const BAD_WORDS = ["시발", "씨발", "병신", "개새", "좆", "fuck", "shit"];
const PHONE_PATTERN = /\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/;

let lastComposeTime = 0;
let composeWarnTimer = null;
let activeNotices = [...notices];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const cardStack = $("#cardStack");
const feedEmpty = $("#feedEmpty");

function loadUserPosts() {
  return userPostsStorage.load().sort((a, b) => Number(b.id) - Number(a.id));
}

function saveUserPosts() {
  userPostsStorage.save(userPosts);
}

function loadNickname() {
  try {
    const value = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed.name !== "string" || typeof parsed.assignedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveNickname(name) {
  try {
    localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify({ name, assignedAt: Date.now() }));
  } catch {
    // localStorage 사용 불가 시 조용히 무시
  }
}

function resolveNickname() {
  const stored = loadNickname();
  if (stored && Date.now() - stored.assignedAt < NICKNAME_TTL_MS) {
    return stored.name;
  }
  const name = NICKNAME_CANDIDATES[Math.floor(Math.random() * NICKNAME_CANDIDATES.length)];
  saveNickname(name);
  return name;
}

function isWithinRadius(post) {
  return !post._coords || post._distanceMeters <= NEARBY_RADIUS_METERS;
}

function createFeed() {
  return [...userPosts, ...posts].filter(
    (post) => !hiddenIds.includes(post.id) && !blockedAuthors.includes(post.who) && isWithinRadius(post),
  );
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
          <div class="mini-avatar">${escapeHtml(post.who.at(-1))}</div>
          <strong>${escapeHtml(post.who)}</strong>
          <span class="distance">${escapeHtml(post.distance)}</span>
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
  const votedIndex = votedOptions.get(post.id);
  return `
    <div class="vote-options">
      ${post.options.map((option, index) => `
        <button class="vote-option ${votedIndex === index ? "is-voted" : ""}" data-vote-post="${post.id}" data-vote-option="${index}" style="--pct:${option.pct}%" ${votedIndex !== undefined ? "disabled" : ""}>
          <i class="bar"></i>
          <span>${escapeHtml(option.label)}</span>
          <b>${option.pct}%</b>
        </button>
      `).join("")}
    </div>
  `;
}

function submitVote(button) {
  const postId = Number(button.dataset.votePost);
  if (votedOptions.has(postId)) return;
  votedOptions.set(postId, Number(button.dataset.voteOption));
  votedOptionsStorage.save([...votedOptions]);
  renderFeed();
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
  const postId = Number(id);
  const alreadyReported = reportedIds.includes(postId);
  const post = feed.find((item) => item.id === postId);
  const alreadyReportedAuthor = post ? reportedAuthors.includes(post.who) : false;
  menu.innerHTML = `
    <button type="button" data-action="hide">숨기기</button>
    <button type="button" data-action="report" ${alreadyReported ? "disabled" : ""}>${alreadyReported ? "신고 완료" : "신고하기"}</button>
    <button type="button" data-action="report-author" ${alreadyReportedAuthor ? "disabled" : ""}>${alreadyReportedAuthor ? "작성자 신고 완료" : "작성자 신고하기"}</button>
    <button type="button" data-action="block">차단하기</button>
  `;

  menu.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target || target.disabled) return;
    event.stopPropagation();
    const action = target.dataset.action;
    closeCardMenu();
    if (action === "hide") hidePost(id);
    else if (action === "report") reportPost(id);
    else if (action === "report-author") reportAuthor(id);
    else if (action === "block") blockAuthor(id);
  });

  button.parentElement.style.position = "relative";
  button.parentElement.append(menu);
  document.addEventListener("pointerdown", onCardMenuOutside, true);
  document.addEventListener("keydown", onCardMenuKeydown);
}

function closeCardMenu() {
  $$(".card-menu").forEach((menu) => menu.remove());
  document.removeEventListener("pointerdown", onCardMenuOutside, true);
  document.removeEventListener("keydown", onCardMenuKeydown);
}

function onCardMenuOutside(event) {
  if (event.target.closest(".card-menu, .more-button")) return;
  closeCardMenu();
}

function onCardMenuKeydown(event) {
  if (event.key === "Escape") closeCardMenu();
}

function hidePost(id) {
  const postId = Number(id);
  if (!hiddenIds.includes(postId)) {
    hiddenIds.push(postId);
    hiddenIdsStorage.save(hiddenIds);
  }
  feed = feed.filter((post) => post.id !== postId);
  renderFeed();
}

function blockAuthor(id) {
  const postId = Number(id);
  const post = feed.find((item) => item.id === postId);
  if (!post) return;
  const author = post.who;
  if (!blockedAuthors.includes(author)) {
    blockedAuthors.push(author);
    blockedAuthorsStorage.save(blockedAuthors);
  }
  feed = feed.filter((item) => item.who !== author);
  renderFeed();
  showToast(`${author}님의 글을 더 이상 보지 않아요`);
}

function reportOnce(list, storage, key, alreadyMessage, doneMessage) {
  if (list.includes(key)) {
    showToast(alreadyMessage);
    return false;
  }
  list.push(key);
  storage.save(list);
  showToast(doneMessage);
  return true;
}

function reportPost(id) {
  reportOnce(reportedIds, reportedIdsStorage, Number(id), "이미 신고한 게시물이에요", "신고가 접수됐어요");
}

function reportAuthor(id) {
  const postId = Number(id);
  const post = feed.find((item) => item.id === postId);
  if (!post) return;
  const author = post.who;
  reportOnce(reportedAuthors, reportedAuthorsStorage, author, "이미 신고한 작성자예요", `${author}님을 신고했어요`);
}

function reportComment(postId, commentIndex) {
  const reportId = getCommentReportId(postId, commentIndex);
  if (!reportOnce(reportedComments, reportedCommentsStorage, reportId, "이미 신고한 댓글이에요", "댓글을 신고했어요")) return;
  renderDetail(activeDetailPost);
}

function showToast(message) {
  const existing = $("#cardToast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.id = "cardToast";
  toast.className = "card-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  $(".app-screen").append(toast);
  toast.classList.add("is-visible");
  setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 300);
  }, 1600);
}

function updateLiveCount() {
  const live = 17 + Math.floor(Math.random() * 18);
  $("#liveCount").textContent = `${live}명`;
}

function renderNotices() {
  const list = $("#noticeList");
  if (activeNotices.length === 0) {
    list.innerHTML = `<p class="notice-empty">새로운 알림이 없어요</p>`;
    return;
  }
  list.innerHTML = activeNotices.map(([icon, text, time], index) => `
    <article class="notice-card">
      <div class="notice-icon">${icon}</div>
      <div>
        <strong>${escapeHtml(text)}</strong>
        <span>${escapeHtml(time)}</span>
      </div>
      <button class="notice-dismiss" data-dismiss="${index}" aria-label="알림 닫기">×</button>
    </article>
  `).join("");
}

function dismissNotice(index) {
  activeNotices.splice(index, 1);
  renderNotices();
}

function renderBlockedList() {
  const list = $("#blockedList");
  if (blockedAuthors.length === 0) {
    list.innerHTML = `<p class="blocked-empty">차단한 사용자가 없어요</p>`;
    return;
  }
  list.innerHTML = blockedAuthors.map((author) => `
    <article class="blocked-card">
      <div class="mini-avatar">${escapeHtml(author.at(-1))}</div>
      <strong>${escapeHtml(author)}</strong>
      <button class="unblock-button" data-unblock="${escapeHtml(author)}">차단 해제</button>
    </article>
  `).join("");
}

function unblockAuthor(author) {
  blockedAuthors = blockedAuthors.filter((a) => a !== author);
  blockedAuthorsStorage.save(blockedAuthors);
  renderBlockedList();
  showToast(`${author}님의 차단을 해제했어요`);
}

function renderHiddenList() {
  const list = $("#hiddenList");
  if (hiddenIds.length === 0) {
    list.innerHTML = `<p class="hidden-empty">숨긴 게시물이 없어요</p>`;
    return;
  }
  const allPosts = [...userPosts, ...posts];
  list.innerHTML = hiddenIds.map((id) => {
    const post = allPosts.find((item) => item.id === id);
    if (!post) return "";
    const preview = post.text.length > 20 ? `${post.text.slice(0, 20)}…` : post.text;
    return `
      <article class="hidden-card">
        <div class="mini-avatar">${escapeHtml(post.who.at(-1))}</div>
        <div class="hidden-info">
          <strong>${escapeHtml(preview)}</strong>
          <span>${escapeHtml(post.who)}</span>
        </div>
        <button class="unhide-button" data-unhide="${id}">숨김 해제</button>
      </article>
    `;
  }).join("");
}

function unhidePost(id) {
  const postId = Number(id);
  hiddenIds = hiddenIds.filter((hiddenId) => hiddenId !== postId);
  hiddenIdsStorage.save(hiddenIds);
  renderHiddenList();
  showToast("숨김을 해제했어요");
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

function renderDetail(post) {
  $("#detailBody").innerHTML = `
    <p class="tiny-label">${escapeHtml(post.who)} · ${escapeHtml(post.distance)}</p>
    <h3 id="detailTitle" class="sheet-title">${escapeHtml(post.text)}</h3>
    <div class="reaction-row">${post.reactions.map((reaction) => `<span>${escapeHtml(reaction)}</span>`).join("")}</div>
    <div class="comment-list">
      ${post.comments.map(([who, text], index) => {
        const reportId = getCommentReportId(post.id, index);
        const alreadyReported = reportedComments.includes(reportId);
        return `
        <div class="comment-item">
          <div class="comment-meta">
            <strong>${escapeHtml(who)}</strong>
            <button
              type="button"
              class="comment-report"
              data-report-comment="${index}"
              ${alreadyReported ? "disabled" : ""}
              aria-label="${alreadyReported ? "신고 완료된 댓글" : "댓글 신고"}"
              title="${alreadyReported ? "신고 완료" : "댓글 신고"}"
            >${alreadyReported ? "신고 완료" : "신고"}</button>
          </div>
          <p>${escapeHtml(text)}</p>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function openDetail(id) {
  const postId = Number(id);
  const post = feed.find((item) => item.id === postId) || userPosts.find((item) => item.id === postId) || posts.find((item) => item.id === postId);
  if (!post) return;
  activeDetailPost = post;
  $("#commentInput").value = "";
  renderDetail(post);
  $("#detailSheet").showModal();
}

function submitComment(event) {
  event.preventDefault();
  if (!activeDetailPost) return;

  const input = $("#commentInput");
  const value = input.value.trim();
  if (!value) return;

  if (containsBadWord(value, BAD_WORDS)) {
    showToast("부적절한 표현이 포함되어 있어요");
    return;
  }
  if (containsPhoneNumber(value, PHONE_PATTERN)) {
    showToast("전화번호 등 개인정보는 공유할 수 없어요");
    return;
  }
  if (containsLocationHint(value)) {
    showToast("위치를 특정할 수 있는 표현은 피해주세요");
    return;
  }

  activeDetailPost.comments.push([currentNickname, value]);
  input.value = "";
  renderDetail(activeDetailPost);
  renderFeed();
  renderMyPosts();
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
  const cooldownRemainingMs = getComposeCooldownRemainingMs(lastComposeTime, now, COMPOSE_COOLDOWN_MS);
  if (cooldownRemainingMs > 0) {
    showComposeWarn(`잠시 후 다시 시도해주세요 (${Math.ceil(cooldownRemainingMs / 1000)}초)`);
    return;
  }

  if (containsBadWord(value, BAD_WORDS)) {
    showComposeWarn("부적절한 표현이 포함되어 있어요. 다시 작성해주세요.");
    return;
  }
  if (containsPhoneNumber(value, PHONE_PATTERN)) {
    showComposeWarn("전화번호 등 개인정보는 공유할 수 없어요.");
    return;
  }
  if (containsLocationHint(value)) {
    showComposeWarn("위치를 특정할 수 있는 표현은 피해주세요.");
    return;
  }

  lastComposeTime = now;
  const item = {
    id: now,
    type: composeType,
    who: currentNickname,
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
  if (tab === "profile") {
    renderBlockedList();
    renderHiddenList();
  }
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
  $("#commentForm").addEventListener("submit", submitComment);
  $("#detailBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-comment]");
    if (!button || button.disabled || !activeDetailPost) return;
    reportComment(activeDetailPost.id, Number(button.dataset.reportComment));
  });
  $("#noticeList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dismiss]");
    if (!btn) return;
    dismissNotice(Number(btn.dataset.dismiss));
  });
  $("#blockedList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-unblock]");
    if (!btn) return;
    unblockAuthor(btn.dataset.unblock);
  });
  $("#hiddenList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-unhide]");
    if (!btn) return;
    unhidePost(btn.dataset.unhide);
  });
  $("#composeInput").addEventListener("input", () => {
    const warn = $("#composeWarn");
    if (!warn.hidden) {
      warn.hidden = true;
      clearTimeout(composeWarnTimer);
    }
  });
  cardStack.addEventListener("click", (event) => {
    const voteButton = event.target.closest(".vote-option");
    if (voteButton) {
      event.stopPropagation();
      submitVote(voteButton);
      return;
    }
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

function initGeoDistances() {
  getCurrentPosition()
    .then(({ lat, lng }) => {
      for (const post of [...posts, ...userPosts]) {
        if (post._coords) continue;
        const { lat: pLat, lng: pLng } = assignNearbyCoordinate(lat, lng, NEARBY_RADIUS_METERS);
        post._coords = { lat: pLat, lng: pLng };
        post._distanceMeters = haversineDistanceMeters(lat, lng, pLat, pLng);
        post.distance = formatDistanceMeters(post._distanceMeters);
      }
      feed = feed.filter(isWithinRadius);
      renderFeed();
    })
    .catch(() => {
      showToast("위치 정보를 가져오지 못했어요, 기본 거리로 표시해요");
    });
}

$("#myNickname").textContent = currentNickname;
renderFeed();
renderNotices();
renderMyPosts();
renderBlockedList();
renderHiddenList();
bindEvents();
initGeoDistances();
