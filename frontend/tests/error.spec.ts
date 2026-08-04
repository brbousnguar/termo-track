import { test, expect, type Page } from "@playwright/test";

const MOCK_STATS = {
  temp_min: 18.2,
  temp_max: 24.8,
  temp_avg: 21.5,
  hum_min: 40,
  hum_max: 65,
  hum_avg: 52,
  count: 120,
};

const MOCK_READING = {
  type: "reading",
  temperature: 22.5,
  humidity: 55,
  battery: 80,
  device: "TP-357",
  timestamp: new Date().toISOString(),
};

async function setupMocks(page: Page, failHistory = false, failStats = false) {
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
  await page.route("**/api/history*", (route) => {
    if (failHistory) {
      route.fulfill({ status: 500, body: "Internal Server Error" });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) });
    }
  });
  await page.route("**/api/stats*", (route) => {
    if (failStats) {
      route.fulfill({ status: 500, body: "Internal Server Error" });
    } else {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) });
    }
  });
  await page.route("**/api/health", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
  );
}

test.describe("Error states", () => {
  test("shows error state when history API fails", async ({ page }) => {
    await setupMocks(page, true, false);
    await page.goto("/");

    // Wait for the history card to show error
    const historyCard = page.locator(".card").filter({ hasText: "History" });
    await expect(historyCard).toBeVisible();

    // Should show error text
    const errorText = historyCard.locator(".error-text");
    await expect(errorText).toBeVisible();
    await expect(errorText).toContainText("Failed");

    // Should have a retry button
    const retryBtn = historyCard.locator("button", { hasText: "Retry" });
    await expect(retryBtn).toBeVisible();
  });

  test("shows error state when stats API fails", async ({ page }) => {
    await setupMocks(page, false, true);
    await page.goto("/");

    // Wait for the stats card to show error
    const statsCard = page.locator(".card").filter({ hasText: "summary" });
    await expect(statsCard).toBeVisible();

    const errorText = statsCard.locator(".error-text");
    await expect(errorText).toBeVisible();
    await expect(errorText).toContainText("Failed");

    const retryBtn = statsCard.locator("button", { hasText: "Retry" });
    await expect(retryBtn).toBeVisible();
  });

  test("retry button re-fetches data", async ({ page }) => {
    // First fail, then succeed
    let failed = true;
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
    await page.route("**/api/history*", (route) => {
      if (failed) {
        route.fulfill({ status: 500, body: "Internal Server Error" });
      } else {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) });
      }
    });
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) }),
    );
    await page.route("**/api/health", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
    );

    await page.goto("/");

    // Error should be visible
    const historyCard = page.locator(".card").filter({ hasText: "History" });
    await expect(historyCard.locator(".error-text")).toBeVisible();

    // Click retry
    failed = false;
    await historyCard.locator("button", { hasText: "Retry" }).click();

    // Error should disappear (skeleton or empty state)
    await expect(historyCard.locator(".error-text")).not.toBeVisible({ timeout: 5000 });
  });
});
