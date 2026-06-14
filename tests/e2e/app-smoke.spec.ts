import { expect, test, type Page } from "@playwright/test";
import { installMockGateway, mockGatewayMethods } from "./support/mock-gateway";

type RecordedRequest = {
  method: string;
  params?: {
    auth?: { token?: string };
    client?: { id?: string; mode?: string };
    maxProtocol?: number;
    minProtocol?: number;
    role?: string;
    scopes?: string[];
  };
};

async function prepareApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("cove:hasCompletedOnboarding", JSON.stringify(true));
  });
  await installMockGateway(page);
}

async function connectToMockGateway(page: Page): Promise<void> {
  await prepareApp(page);
  await page.goto("/");

  await expect(page).toHaveTitle(/Cove/);
  await expect(page.getByRole("heading", { name: "Cove" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect to Gateway" })).toBeVisible();

  await page.getByLabel("Gateway URL").fill("ws://gateway.test");
  await page.getByLabel("Token").fill("test-token");
  await page.getByRole("button", { name: "Connect" }).click();

  await expectConnectedChat(page);
}

async function expectConnectedChat(page: Page): Promise<void> {
  await expect(page.getByRole("main")).toContainText("Chat with Test Assistant");
  await expect(page.getByRole("main")).toContainText(
    "Send a message to begin chatting with your assistant",
  );
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
}

test.describe("Cove app smoke", () => {
  test("loads the connected shell through a mocked gateway", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await connectToMockGateway(page);

    const requests = await page.evaluate(
      () =>
        (window as unknown as { __coveMockGatewayRequests?: RecordedRequest[] })
          .__coveMockGatewayRequests ?? [],
    );
    const connectRequest = requests.find((request) => request.method === "connect");
    expect(connectRequest?.params).toMatchObject({
      minProtocol: 4,
      maxProtocol: 4,
      client: {
        id: "openclaw-control-ui",
        mode: "ui",
      },
      role: "operator",
      auth: {
        token: "test-token",
      },
    });
    expect(connectRequest?.params?.scopes).toEqual([
      "operator.admin",
      "operator.read",
      "operator.write",
    ]);

    const methods = await mockGatewayMethods(page);
    expect(methods).toContain("connect");
    expect(methods).toContain("sessions.list");
    expect(methods).toContain("chat.history");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("supports desktop shell navigation, fallback routes, and skip link", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop sidebar navigation is covered by the desktop project");

    await prepareApp(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Connect to Gateway" })).toBeVisible();

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await skipLink.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);

    await page.getByLabel("Gateway URL").fill("ws://gateway.test");
    await page.getByLabel("Token").fill("test-token");
    await page.getByRole("button", { name: "Connect" }).click();
    await expectConnectedChat(page);

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("main")).toContainText("Gateway Connection");

    await page.getByRole("button", { name: "Chat" }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expectConnectedChat(page);

    await page.goto("/missing-route");
    await expectConnectedChat(page);
    await expect(page).toHaveURL(/\/missing-route$/);
  });

  test("renders standalone canvas without the app shell", async ({ page }) => {
    await prepareApp(page);
    await page.goto("/canvas");

    await expect(page.getByText("No content to display")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });

  test("keeps rotated device tokens visible when clipboard copy fails", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop device token flow is covered by the desktop project");

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("clipboard denied");
          },
        },
      });
    });
    await connectToMockGateway(page);

    await page.getByRole("button", { name: "Devices" }).click();
    await expect(page).toHaveURL(/\/devices$/);
    await expect(page.getByRole("button", { name: "Toggle details for Laptop" })).toBeVisible();

    await page.getByRole("button", { name: "Toggle details for Laptop" }).click();
    await page.getByRole("button", { name: "Rotate token" }).click();
    await page.getByRole("button", { name: "Rotate", exact: true }).click();

    await expect(
      page.getByText(
        "Token rotated, but it could not be copied. Copy it before closing this dialog.",
      ),
    ).toBeVisible();
    const copiedToken = page.getByRole("textbox", { name: "Token" });
    await expect(copiedToken).toHaveValue("one-time-token");

    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(copiedToken).toHaveCount(0);

    await page.getByRole("button", { name: "Rotate token" }).click();
    await expect(copiedToken).toHaveCount(0);
  });

  test("opens and closes the mobile sidebar overlay", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile overlay is only visible in the mobile project");

    await connectToMockGateway(page);

    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(page.getByRole("complementary")).toBeVisible();
    await expect(page.locator('div[aria-hidden="true"].fixed.inset-0')).toBeVisible();

    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("main")).toContainText("Gateway Connection");
    await expect(page.locator('div[aria-hidden="true"].fixed.inset-0')).toHaveCount(0);
  });
});
