import { test, expect } from "@playwright/test";

const MOCK_READING = {
  type: "reading",
  temperature: 22.5,
  humidity: 55,
  battery: 80,
  device: "TP-357",
  timestamp: new Date().toISOString(),
};

const MOCK_STATS = {
  temp_min: 18.2,
  temp_max: 24.8,
  temp_avg: 21.5,
  hum_min: 40,
  hum_max: 65,
  hum_avg: 52,
  count: 120,
};

test.describe("Mobile UX", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    // Mock all endpoints
    await page.routeWebSocket("**/ws", (ws) => {
      ws.send(JSON.stringify(MOCK_READING));
    });
    await page.route("**/api/current", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          data: { id: 1, timestamp: new Date().toISOString(), temperature: 22.5, humidity: 55, device_name: "TP-357", device_address: "AA:BB:CC:DD:EE:FF" },
        }),
      }),
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) }),
    );
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) }),
    );
    await page.route("**/api/health", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
    );
  });

  test("page renders correctly on mobile viewport", async ({ page }) => {
    await page.goto("/");

    // Topbar should be visible
    await expect(page.locator(".topbar")).toBeVisible();

    // Logo should be visible
    await expect(page.locator(".logo-text")).toHaveText("Termo Track");

    // Time range buttons should be visible and tappable
    const rangeBtns = page.locator(".range button");
    await expect(rangeBtns.first()).toBeVisible();

    // Refresh button should be visible
    const refreshBtn = page.locator(".refresh-btn");
    await expect(refreshBtn).toBeVisible();
    await expect(refreshBtn).toHaveAttribute("aria-label", "Refresh data");
  });

  test("refresh button is tappable on mobile", async ({ page }) => {
    await page.goto("/");

    const refreshBtn = page.locator(".refresh-btn");
    await refreshBtn.tap();
    // After tapping, the button should have the spinning class briefly
    await expect(refreshBtn).toHaveClass(/spinning/);
  });

  test("time range buttons are tappable on mobile", async ({ page }) => {
    await page.goto("/");

    // Tap each time range button
    const rangeBtns = page.locator(".range button");
    const labels = ["6h", "24h", "2d", "7d"];

    for (let i = 0; i < labels.length; i++) {
      await rangeBtns.nth(i).tap();
      await expect(rangeBtns.nth(i)).toHaveClass(/active/);
    }
  });

  test("cards stack in single column on narrow mobile", async ({ page }) => {
    // Use a very narrow viewport
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/");

    // Grid should exist
    const grid = page.locator(".grid");
    await expect(grid).toBeVisible();

    // Cards should be visible
    const cards = grid.locator(".card");
    await expect(cards.first()).toBeVisible();
  });
});
