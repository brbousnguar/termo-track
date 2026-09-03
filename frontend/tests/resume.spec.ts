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

test.describe("Mobile PWA Resume and Live Reading Recovery", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("app resume fetches /api/current and recovers live reading from stale state", async ({ page }) => {
    // 1. Initial state: /api/current returns a reading older than 2 minutes (stale)
    const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let currentData = {
      id: 1,
      timestamp: staleTime,
      temperature: 15.0,
      humidity: 40,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    let apiCurrentCalls = 0;

    await page.routeWebSocket("**/ws", (ws) => {
      ws.send(JSON.stringify({
        type: "reading",
        temperature: 15.0,
        humidity: 40,
        battery: 80,
        device: "TP-357",
        timestamp: staleTime,
      }));
    });

    await page.route("**/api/current", (route) => {
      apiCurrentCalls++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", data: currentData }),
      });
    });

    await page.route("**/api/history*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) }),
    );
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) }),
    );
    await page.route("**/api/health", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) }),
    );

    await page.goto("/");

    // Hero section should initially show stale banner
    const staleBanner = page.locator(".stale-banner");
    await expect(staleBanner).toBeVisible();
    await expect(staleBanner).toContainText("Data may be stale");
    await expect(staleBanner).toContainText("scanner_daemon.py");

    expect(apiCurrentCalls).toBeGreaterThanOrEqual(1);

    // 2. Simulate scanner daemon updating /api/current with a fresh reading while PWA was suspended
    const freshTime = new Date().toISOString();
    currentData = {
      id: 2,
      timestamp: freshTime,
      temperature: 23.4,
      humidity: 52,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    // 3. Simulate iOS PWA resume (visibilitychange -> visible)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", writable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // 4. Stale warning must disappear and temperature must update to 23.4
    await expect(staleBanner).not.toBeVisible({ timeout: 5000 });
    const tempDisplay = page.locator(".hero-temp");
    await expect(tempDisplay).toContainText("23.4");
  });

  test("manual refresh button fetches /api/current and recovers live reading", async ({ page }) => {
    const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let currentData = {
      id: 10,
      timestamp: staleTime,
      temperature: 12.0,
      humidity: 30,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    await page.routeWebSocket("**/ws", (ws) => {
      ws.send(JSON.stringify({
        type: "reading",
        temperature: 12.0,
        humidity: 30,
        battery: 50,
        device: "TP-357",
        timestamp: staleTime,
      }));
    });

    await page.route("**/api/current", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", data: currentData }),
      });
    });

    await page.route("**/api/history*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) }),
    );
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) }),
    );

    await page.goto("/");

    const staleBanner = page.locator(".stale-banner");
    await expect(staleBanner).toBeVisible();

    // Scanner daemon gets a fresh reading
    currentData = {
      id: 11,
      timestamp: new Date().toISOString(),
      temperature: 21.8,
      humidity: 48,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    // User taps refresh button
    const refreshBtn = page.locator(".refresh-btn");
    await refreshBtn.tap();

    // Stale banner disappears and temp updates
    await expect(staleBanner).not.toBeVisible({ timeout: 5000 });
    const tempDisplay = page.locator(".hero-temp");
    await expect(tempDisplay).toContainText("21.8");
  });

  test("network recovery (online event) triggers /api/current fetch and recovers live reading", async ({ page }) => {
    const staleTime = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    let currentData = {
      id: 20,
      timestamp: staleTime,
      temperature: 10.0,
      humidity: 35,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    await page.routeWebSocket("**/ws", (ws) => {
      ws.send(JSON.stringify({
        type: "reading",
        temperature: 10.0,
        humidity: 35,
        timestamp: staleTime,
      }));
    });

    await page.route("**/api/current", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", data: currentData }),
      });
    });

    await page.route("**/api/history*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: [], count: 0 }) }),
    );
    await page.route("**/api/stats*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", data: MOCK_STATS }) }),
    );

    await page.goto("/");

    const staleBanner = page.locator(".stale-banner");
    await expect(staleBanner).toBeVisible();

    // Network recovers, server has new reading
    currentData = {
      id: 21,
      timestamp: new Date().toISOString(),
      temperature: 24.1,
      humidity: 50,
      device_name: "TP-357",
      device_address: "AA:BB:CC:DD:EE:FF",
    };

    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    await expect(staleBanner).not.toBeVisible({ timeout: 5000 });
    const tempDisplay = page.locator(".hero-temp");
    await expect(tempDisplay).toContainText("24.1");
  });
});
