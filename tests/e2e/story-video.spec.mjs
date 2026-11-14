import { test, expect } from "@playwright/test";

test("the full film loads only after a click and supports pause, resume and seeking", async ({
  page,
}) => {
  const mediaRequests = [];
  page.on("request", (r) => {
    if (r.url().endsWith(".mp4")) mediaRequests.push(r.url());
  });
  await page.goto("productos/");
  const video = page.locator("#brand-story-video");
  await expect(page.locator(".story-poster-play")).toBeVisible();
  expect(mediaRequests).toEqual([]);
  await expect(video).toHaveAttribute("preload", "none");
  expect(await video.evaluate((v) => v.autoplay)).toBe(false);
  await page.locator(".story-poster-play").press("Enter");
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 15000 })
    .toBeGreaterThan(0.1);
  expect(await video.evaluate((v) => v.duration)).toBeCloseTo(99.716, 1);
  expect(await video.evaluate((v) => v.videoWidth)).toBeGreaterThanOrEqual(
    1280,
  );
  expect(await video.evaluate((v) => v.controls && !v.muted)).toBe(true);
  await expect(page.locator(".story-poster-play")).toBeHidden();
  await page.getByRole("button", { name: "Pausar video", exact: true }).click();
  expect(await video.evaluate((v) => v.paused)).toBe(true);
  await page
    .getByRole("button", { name: "Continuar video", exact: true })
    .click();
  await expect.poll(() => video.evaluate((v) => v.paused)).toBe(false);
  // Verify that the ending is included and accessible, not just the opening clip.
  await video.evaluate((v) => {
    v.currentTime = 97;
  });
  await expect
    .poll(() => video.evaluate((v) => v.currentTime), { timeout: 15000 })
    .toBeGreaterThan(97.1);
  await expect
    .poll(() => video.evaluate((v) => v.ended), { timeout: 15000 })
    .toBe(true);
  await expect(page.locator(".story-watch")).toHaveText("Volver a ver · 1:40");
  await page.locator(".story-watch").click();
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeLessThan(5);
  expect(mediaRequests.length).toBeGreaterThan(0);
});

test("the video band follows the hero, preserves the frame and fits desktop and mobile", async ({
  page,
}, info) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("productos/");
    const layout = await page.evaluate(() => {
      const rect = (s) => document.querySelector(s).getBoundingClientRect();
      const hero = rect(".product-hero"),
        story = rect(".product-story"),
        video = rect(".product-story-video"),
        copy = rect(".product-story-copy"),
        nav = rect(".product-navigation");
      return {
        gap: story.top - hero.bottom,
        navGap: nav.top - story.bottom,
        ratio: video.width / video.height,
        copyTop: copy.top,
        videoBottom: video.bottom,
        copyLeft: copy.left,
        videoRight: video.right,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(Math.abs(layout.gap)).toBeLessThan(2);
    expect(Math.abs(layout.navGap)).toBeLessThan(2);
    expect(layout.ratio).toBeCloseTo(16 / 9, 1);
    expect(layout.overflow).toBeLessThanOrEqual(1);
    if (width <= 760)
      expect(layout.copyTop).toBeGreaterThan(layout.videoBottom);
    else expect(layout.copyLeft).toBeGreaterThan(layout.videoRight);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: info.outputPath(`historia-${width}.png`),
        fullPage: true,
      });
  }
});

test("native controls still work without JavaScript, and the media supports byte ranges", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4194/Mabell-Ramos/productos/");
  await expect(page.locator("video")).toHaveAttribute("controls", "");
  await expect(page.locator(".story-poster-play")).toBeHidden();
  await expect(page.locator(".story-no-js-duration")).toBeVisible();
  const source = await page.locator("video source").getAttribute("src");
  const response = await request.get(source, {
    headers: { Range: "bytes=0-63" },
  });
  expect(response.status()).toBe(206);
  expect(response.headers()["content-type"]).toBe("video/mp4");
  expect((await response.body()).length).toBe(64);
  const lastBytes = await request.get(source, {
    headers: { Range: "bytes=-64" },
  });
  expect(lastBytes.status()).toBe(206);
  expect((await lastBytes.body()).length).toBe(64);
  const invalid = await request.get(source, {
    headers: { Range: "bytes=999999999-" },
  });
  expect(invalid.status()).toBe(416);
  await context.close();
});
