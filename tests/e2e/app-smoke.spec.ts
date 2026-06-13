import { expect, test } from "@playwright/test";
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

    await page.addInitScript(() => {
      localStorage.setItem("cove:hasCompletedOnboarding", JSON.stringify(true));
    });
    await installMockGateway(page);
    await page.goto("/");

    await expect(page).toHaveTitle(/Cove/);
    await expect(page.getByRole("heading", { name: "Cove" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect to Gateway" })).toBeVisible();

    await page.getByLabel("Gateway URL").fill("ws://gateway.test");
    await page.getByLabel("Token").fill("test-token");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByRole("main")).toContainText("Chat with Test Assistant");
    await expect(page.getByRole("main")).toContainText(
      "Send a message to begin chatting with your assistant",
    );
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();

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
});
