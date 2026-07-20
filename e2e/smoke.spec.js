import { test, expect } from "@playwright/test";

// 여러 테스트가 하나의 세션(localStorage) 흐름을 공유하므로 순서대로, 같은 페이지로 실행한다.
test.describe.configure({ mode: "serial" });

test.describe("TMI Nearby smoke", () => {
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    page.on("pageerror", (err) => {
      throw new Error(`page error: ${err}`);
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("초기 로드 시 카드 스택이 렌더된다", async () => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("#cardStack .tmi-card").first()).toBeVisible();
  });

  test("차단 → 프로필에서 차단 해제 → 메인 피드에 다시 나타남", async () => {
    const firstCard = page.locator("#cardStack .tmi-card").first();
    const author = await firstCard.locator(".card-user strong").innerText();

    await firstCard.locator(".more-button").click();
    await page.locator('.card-menu button:has-text("차단하기")').click();
    await expect(page.locator("#cardStack .tmi-card .card-user strong", { hasText: author })).toHaveCount(0);

    await page.locator('[data-tab="profile"]').click();
    const unblockBtn = page.locator(`#blockedList [data-unblock="${author}"]`);
    await expect(unblockBtn).toBeVisible();
    await unblockBtn.click();

    await page.locator('[data-tab="feed"]').click();
    await expect(page.locator("#cardStack .tmi-card .card-user strong", { hasText: author }).first()).toBeVisible();
  });

  test("투표는 새로고침해도 유지된다", async () => {
    const voteCard = page.locator("#cardStack .tmi-card:has(.vote-options)").first();
    if ((await voteCard.count()) === 0) test.skip(true, "현재 피드에 투표 카드 없음");

    // 스택에서 다른 카드에 가려질 수 있어(카드 간 겹침) DOM에 직접 클릭 이벤트를 dispatch한다.
    await voteCard.locator(".vote-option").first().evaluate((el) => el.click());
    await expect(voteCard.locator(".vote-option.is-voted")).toHaveCount(1);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#cardStack .tmi-card .vote-option.is-voted").first()).toBeVisible();
  });

  test("카드 드래그 스와이프로 다음 카드로 넘어간다", async () => {
    await page.locator('[data-tab="feed"]').click();
    const card = page.locator("#cardStack .tmi-card").first();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    const textBefore = await card.locator(".card-text").innerText();
    const [startX, startY] = [box.x + box.width / 2, box.y + box.height / 2];

    await page.evaluate(([sx, sy]) => {
      const el = document.querySelector("#cardStack .tmi-card");
      const fire = (type, x) =>
        el.dispatchEvent(
          new PointerEvent(type, { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, clientX: x, clientY: sy, bubbles: true, cancelable: true }),
        );
      fire("pointerdown", sx);
      for (let i = 1; i <= 15; i++) fire("pointermove", sx + i * 25);
    }, [startX, startY]);

    await expect(card).toHaveClass(/is-dragging/);

    await page.evaluate(([sx, sy]) => {
      const el = document.querySelector("#cardStack .tmi-card");
      el.dispatchEvent(
        new PointerEvent("pointerup", { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, clientX: sx + 15 * 25, clientY: sy, bubbles: true, cancelable: true }),
      );
    }, [startX, startY]);

    await expect
      .poll(async () => (await page.locator("#cardStack .tmi-card").first().locator(".card-text").innerText()) !== textBefore)
      .toBe(true);
  });

  test("알림 닫기는 새로고침해도 유지된다", async () => {
    await page.locator('[data-tab="notifications"]').click();
    const dismissBtn = page.locator("#noticeList [data-dismiss]").first();
    if ((await dismissBtn.count()) === 0) test.skip(true, "닫을 알림 없음");

    const countBefore = await page.locator("#noticeList [data-dismiss]").count();
    await dismissBtn.click();
    await expect(page.locator("#noticeList [data-dismiss]")).toHaveCount(countBefore - 1);

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-tab="notifications"]').click();
    await expect(page.locator("#noticeList [data-dismiss]")).toHaveCount(countBefore - 1);
  });

  test("민감정보 입력 시 경고, 재오픈 시 초기화", async () => {
    await page.locator('[data-tab="feed"]').click();
    await page.locator("#composeButton").click();
    await page.locator("#composeInput").fill("010-1234-5678로 연락주세요");
    await page.locator("#submitCompose").click();
    await expect(page.locator("#composeWarn")).toBeVisible();

    await page.locator("#composeSheet .sheet-close").click();
    await page.locator("#composeButton").click();
    await expect(page.locator("#composeInput")).toHaveValue("");
    await expect(page.locator("#composeWarn")).toBeHidden();
    await page.locator("#composeSheet .sheet-close").click();
  });

  test("내 글 작성 → 댓글 작성 → 새로고침해도 유지된다", async () => {
    await page.locator("#composeButton").click();
    const postText = `스모크테스트 글 ${Date.now()}`;
    await page.locator("#composeInput").fill(postText);
    await page.locator("#submitCompose").click();

    const myCard = page.locator("#cardStack .tmi-card", { has: page.locator(".card-text", { hasText: postText }) });
    await expect(myCard).toBeVisible();

    await myCard.locator(".comment-button").click();
    const commentText = `댓글 스모크테스트 ${Date.now()}`;
    await page.locator("#commentInput").fill(commentText);
    await page.locator('.comment-form button[type="submit"]').click();
    await expect(page.locator("#detailBody", { hasText: commentText })).toBeVisible();
    await page.locator("#detailSheet .sheet-close").click();

    await page.reload({ waitUntil: "networkidle" });
    await page.locator('[data-tab="profile"]').click();
    await expect(page.locator("#myPosts")).toContainText(postText);
  });
});
