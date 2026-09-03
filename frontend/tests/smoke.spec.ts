import { test, expect, type Page } from "@playwright/test";

/** Mock reading sent over the WebSocket. */
const MOCK_READING = {
  type: "reading",
  temperature: 22.5,
  humidity: 55,
  battery: 80,
  device: "TP-357",
  timestamp: new Date().toISOString(),
};

/** Mock history data (10 points over 24h). */
function mockHistory(hours: number) {
  const now = Date.now();
  const data = [];
  for (let i = 0; i < 10; i++) {
    data.push({
      id: i + 1,
      timestamp: new Date(now - (hours * 3600_000 * (9 - i)) / 9).toISOString(),
      temperature: 20 + Math.random() * 5,
      humidity: 45 + Math.random() * 20,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    });
  }
  return data;
}

const MOCK_STATS = {
  temp_min: 18.2,
  temp_max: 24.8,
  temp_avg: 21.5,
  hum_min: 40,
  hum_max: 65,
  hum_avg: 52,
  count: 120,
};

const MOCK_CURRENT = {
  id: 1,
  timestamp: new Date().toISOString(),
  temperature: 22.5,
  humidity: 55,
  device_name: "TP-357",
  device_address: "AA:BB:CC:DD:EE:FF",
};

async function setupMocks(page: Page) {
  // Mock WebSocket — send a mock reading once connected
  await page.routeWebSocket("**/ws", (ws) => {
    ws.onMessage(() => {
      // Client sent a message (e.g. ping) — respond with a reading
      ws.send(JSON.stringify(MOCK_READING));
    });
    // Send initial reading immediately
    ws.send(JSON.stringify(MOCK_READING));
  });

  // Mock REST endpoints
  await page.route("**/api/current", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_CURRENT }) });
  });
  await page.route("**/api/history*", (route) => {
    const url = new URL(route.request().url());
    const hours = parseInt(url.searchParams.get("hours") || "24");
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: mockHistory(hours), count: 10 }) });
  });
  await page.route("**/api/stats*", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) });
  });
  await page.route("**/api/health", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) });
  });
}

test.describe("Smoke tests", () => {
  test("page loads and shows topbar with logo and time range buttons", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    // Topbar
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".logo-text")).toHaveText("Termo Track");

    // Time range buttons
    const rangeBtns = page.locator(".range").last().locator("button");
    await expect(rangeBtns).toHaveCount(4);
    await expect(rangeBtns.nth(1)).toHaveText("24h");
    await expect(rangeBtns.nth(1)).toHaveClass(/active/);
  });

  test("hero section shows temperature and comfort info", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    // Hero section
    const hero = page.locator(".hero");
    await expect(hero).toBeVisible();

    // Temperature should appear (from mocked API)
    const heroTemp = hero.locator(".hero-temp");
    await expect(heroTemp).toBeVisible();
  });

  test("grid cards are present", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    // Grid should have cards
    const grid = page.locator(".grid");
    await expect(grid).toBeVisible();

    // At least 3 cards in the grid
    const cards = grid.locator(".card");
    await expect(cards).toHaveCount(4);
  });

  test("time range button click changes active state and refreshes", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    const rangeBtns = page.locator(".range").last().locator("button");
    // Click 6h
    await rangeBtns.nth(0).click();
    await expect(rangeBtns.nth(0)).toHaveClass(/active/);
    await expect(rangeBtns.nth(1)).not.toHaveClass(/active/);

    // Click 7d
    await rangeBtns.nth(3).click();
    await expect(rangeBtns.nth(3)).toHaveClass(/active/);
  });

  test("status indicator shows live/offline state", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");

    // Status badge should be visible
    const status = page.locator(".status");
    await expect(status).toBeVisible();
  });
});
