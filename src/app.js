const posts = [
  {
    id: 1,
    type: "tmi",
    who: "익명의 사과",
    distance: "4m",
    text: "앞에 앉은 분 후드티 어디 거예요? 진짜 예뻐서 그래요",
    comments: [
      ["익명의 복숭아 · 6m", "저도 그거 궁금했어요 ㅋㅋ"],
      ["익명의 너구리 · 2m", "무신사에서 산 것 같은데"],
    ],
    reactions: ["😳 8", "👏 5", "😂 3", "🔥 12", "🤔 2"],
    watching: 27,
  },
  {
    id: 2,
    type: "vote",
    who: "익명의 고양이",
    distance: "11m",
    text: "지금 카페에서 집중 안 될 때 더 나은 선택은?",
    options: [
      { label: "자리 옮기기", pct: 62 },
      { label: "음료 하나 더", pct: 38 },
    ],
    comments: [["익명의 감자 · 9m", "자리 옮기기가 답"], ["익명의 바다 · 12m", "커피 리필은 위험함"]],
    reactions: ["☕ 9", "👀 4", "🫠 6"],
    watching: 19,
  },
  {
    id: 3,
    type: "tmi",
    who: "익명의 라임",
    distance: "18m",
    text: "방금 계산대에서 카드 거꾸로 꽂고 5초 동안 기계랑 눈싸움함",
    comments: [["익명의 밤 · 14m", "나만 그런 게 아니었네"], ["익명의 새우 · 16m", "기계도 당황했을 듯"]],
    reactions: ["😂 14", "💳 3", "🥲 7"],
    watching: 31,
  },
  {
    id: 4,
    type: "vote",
    who: "익명의 두더지",
    distance: "23m",
    text: "엘리베이터에서 아는 사람 만났을 때",
    options: [
      { label: "먼저 인사", pct: 41 },
      { label: "폰 보는 척", pct: 59 },
    ],
    comments: [["익명의 별 · 20m", "폰 보는 척 너무 현실"], ["익명의 연필 · 21m", "인사하면 마음 편함"]],
    reactions: ["📱 16", "🙃 8"],
    watching: 22,
  },
];

const notices = [
  ["♥", "내 TMI가 근처에서 12개의 반응을 받았어요", "방금 전"],
  ["💬", "익명의 복숭아가 댓글을 남겼어요", "3분 전"],
  ["📍", "반경 50m 안에 새 투표가 올라왔어요", "8분 전"],
  ["🔥", "지금 주변에서 가장 많이 본 TMI가 있어요", "14분 전"],
];

const myPosts = [
  ["TMI", "아침에 산 커피 아직도 반 남음. 이 정도면 장식품이다.", "12분 전", "24", "5", "81"],
  ["투표", "점심 메뉴 고르는 데 20분 넘으면 이미 진 거 아닌가요?", "어제", "39", "11", "146"],
];

let feed = [...posts];
let composeType = "tmi";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const cardStack = $("#cardStack");
const feedEmpty = $("#feedEmpty");

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
      <div class="card-text">${post.text}</div>
      ${post.type === "vote" ? voteMarkup(post) : ""}
      <div class="card-bottom">
        <button class="comment-button" data-open-detail="${post.id}">💬 댓글 ${post.comments.length}</button>
        <span class="watching">👀 ${post.watching}명</span>
      </div>
    `;
    cardStack.append(card);
  });
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

function shiftCard(direction = "like") {
  if (!feed.length) return;
  const first = $(".tmi-card");
  if (first) {
    first.style.transform = direction === "like"
      ? "translateX(130px) rotate(12deg)"
      : "translateX(-130px) rotate(-12deg)";
    first.style.opacity = "0";
  }
  setTimeout(() => {
    feed.shift();
    renderFeed();
    updateLiveCount();
  }, 180);
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

function renderMyPosts() {
  $("#myPosts").innerHTML = myPosts.map(([tag, text, time, hearts, comments, views]) => `
    <article class="post-card">
      <div>
        <span>${tag} · ${time}</span>
        <strong>${text}</strong>
        <span>♥ ${hearts} · 💬 ${comments} · 👀 ${views}</span>
      </div>
    </article>
  `).join("");
}

function openDetail(id) {
  const post = posts.find((item) => item.id === Number(id)) || feed[0];
  if (!post) return;
  $("#detailBody").innerHTML = `
    <p class="tiny-label">${post.who} · ${post.distance}</p>
    <h3 id="detailTitle" class="sheet-title">${post.text}</h3>
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

function submitCompose(event) {
  event.preventDefault();
  const value = $("#composeInput").value.trim();
  if (!value) return;
  const item = {
    id: Date.now(),
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
  posts.unshift(item);
  $("#composeInput").value = "";
  $("#composeSheet").close();
  renderFeed();
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
    feed = [...posts];
    renderFeed();
  });
  $("#composeButton").addEventListener("click", openCompose);
  $("#submitCompose").addEventListener("click", submitCompose);
  cardStack.addEventListener("click", (event) => {
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
