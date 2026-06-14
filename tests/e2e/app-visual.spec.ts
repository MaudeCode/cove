import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { installMockGateway, type MockGatewayOptions } from "./support/mock-gateway";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lD8S2QAAAABJRU5ErkJggg==";

type VisualScenario = {
  name: string;
  options?: MockGatewayOptions;
  prepare?: (page: Page, testInfo: TestInfo) => Promise<void>;
  assertions?: (page: Page) => Promise<void>;
};

type ErrorTracker = {
  assertNoErrors: () => void;
};

const now = 1_765_000_000_000;

const activeTranscriptMessages: MockGatewayOptions["messages"] = [
  {
    role: "user",
    timestamp: now - 120_000,
    content:
      "Please summarize the deployment plan and keep this very long filename visible: /Users/example/projects/cove/packages/web/src/components/chat/MessageList.tsx",
  },
  {
    role: "assistant",
    timestamp: now - 90_000,
    content: [
      {
        type: "thinking",
        thinking: "I should verify the app shell, transcript, and composer stay readable.",
      },
      {
        type: "text",
        text: "The plan is ready. I checked the shell, sidebar, transcript, and composer for responsive layout issues.",
      },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: tinyPngBase64,
        },
      },
    ],
  },
];

const noisyToolMessages: MockGatewayOptions["messages"] = [
  {
    role: "user",
    timestamp: now - 240_000,
    content: "Run the release verification and show the important details.",
  },
  {
    role: "assistant",
    timestamp: now - 210_000,
    content: [
      {
        type: "text",
        text: "I will inspect the workspace and run the release checks without exposing raw gateway frames.",
      },
      {
        type: "toolCall",
        id: "tool-exec-long",
        name: "exec",
        arguments: {
          cwd: "/Users/example/projects/cove",
          command:
            'bash -lc \'set -euo pipefail; printf "%s\\n" "shell-wrapper: /usr/bin/env bun run build --filter=@maudecode/cove -- --report very-long-artifact-name-that-should-wrap-without-horizontal-overflow.json"\'',
        },
      },
      {
        type: "text",
        text: "The command finished and produced a bounded summary.",
      },
      {
        type: "toolCall",
        id: "tool-read-failed",
        name: "read",
        arguments: {
          path: "/private/example/missing/file-with-an-extremely-long-name-that-should-not-overflow.json",
        },
      },
    ],
  },
  {
    role: "toolResult",
    toolCallId: "tool-exec-long",
    toolName: "exec",
    timestamp: now - 205_000,
    content: [
      {
        type: "text",
        text: "build passed\nlint passed\nartifact: visual-smoke-shell-wrapper-output-that-wraps-cleanly.txt",
      },
    ],
  },
  {
    role: "toolResult",
    toolCallId: "tool-read-failed",
    toolName: "read",
    isError: true,
    timestamp: now - 204_000,
    content: [
      {
        type: "text",
        text: "ENOENT: no such file or directory, open '/private/example/missing/file-with-an-extremely-long-name-that-should-not-overflow.json'",
      },
    ],
  },
];

const sessions: MockGatewayOptions["sessions"] = [
  {
    key: "agent:main:main",
    label: "Main",
    displayName: "Main",
    kind: "main",
    model: "test/model",
    updatedAt: now,
    totalTokens: 24_000,
    contextTokens: 200_000,
  },
  {
    key: "agent:main:chat:release-qa",
    label: "Release QA with a long readable label",
    kind: "channel",
    model: "anthropic/claude-sonnet-4-5",
    updatedAt: now - 30_000,
    totalTokens: 91_000,
    contextTokens: 200_000,
  },
  {
    key: "agent:main:isolated:nightly-visual-smoke",
    label: "Nightly visual smoke",
    kind: "isolated",
    model: "openai/gpt-5.4",
    updatedAt: now - 70_000,
    totalTokens: 8_000,
    contextTokens: 200_000,
  },
];

const scenarios: VisualScenario[] = [
  {
    name: "empty-chat",
    options: { sessions },
    assertions: async (page) => {
      await expect(
        page.getByText("Send a message to begin chatting with your assistant"),
      ).toBeVisible();
    },
  },
  {
    name: "active-transcript",
    options: { messages: activeTranscriptMessages, sessions },
    assertions: async (page) => {
      await expect(page.getByText("The plan is ready")).toBeVisible();
      await expect(page.getByAltText("Image").first()).toBeVisible();
    },
  },
  {
    name: "noisy-tool-and-failed-tool",
    options: { messages: noisyToolMessages, sessions },
    prepare: async (page) => {
      const messageList = page.locator('[data-tour="message-list"]');
      await messageList.locator('[data-tool-name="exec"] button').click();
      await messageList.locator('[data-tool-name="read"] button').click();
    },
    assertions: async (page) => {
      await expect(page.getByText("shell-wrapper:").first()).toBeVisible();
      await expect(page.getByText("ENOENT: no such file or directory").first()).toBeVisible();
    },
  },
  {
    name: "sidebar-session-list",
    options: { messages: activeTranscriptMessages, sessions },
    prepare: async (page) => {
      if ((await page.getByRole("button", { name: "Toggle sidebar" }).count()) > 0) {
        await page.getByRole("button", { name: "Toggle sidebar" }).click();
      }
    },
    assertions: async (page) => {
      await expect(page.locator('[data-tour="app-sidebar"]')).toContainText("Release QA");
    },
  },
  {
    name: "composer-with-attachment",
    options: { messages: activeTranscriptMessages, sessions },
    prepare: async (page, testInfo) => {
      const attachmentPath = testInfo.outputPath("fixture-attachment.png");
      await import("node:fs/promises").then((fs) =>
        fs.writeFile(attachmentPath, Buffer.from(tinyPngBase64, "base64")),
      );
      const fileChooserPromise = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Attach image" }).click();
      await (await fileChooserPromise).setFiles(attachmentPath);
    },
    assertions: async (page) => {
      await expect(page.getByAltText("fixture-attachment.png")).toBeVisible();
    },
  },
  {
    name: "image-detail-modal",
    options: { messages: activeTranscriptMessages, sessions },
    prepare: async (page) => {
      await page.getByAltText("Image").first().click();
    },
    assertions: async (page) => {
      await expect(page.getByRole("dialog", { name: "Image Viewer" })).toBeVisible();
    },
  },
];

test.describe("Core chat visual smoke", () => {
  for (const scenario of scenarios) {
    test(`${scenario.name} screenshot artifact`, async ({ page }, testInfo) => {
      const errors = await connectWithScenario(page, scenario.options);
      await scenario.prepare?.(page, testInfo);
      await scenario.assertions?.(page);
      await assertVisualHealth(page);
      await attachScreenshot(page, testInfo, scenario.name);
      errors.assertNoErrors();
    });
  }
});

async function connectWithScenario(
  page: Page,
  options: MockGatewayOptions = {},
): Promise<ErrorTracker> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem("cove:hasCompletedOnboarding", JSON.stringify(true));
  });
  if ((options.sessions?.length ?? 0) > 1) {
    await page.addInitScript(() => {
      localStorage.setItem("cove:app-mode", JSON.stringify("multi"));
    });
  }
  await installMockGateway(page, options);
  await page.goto("/");
  await page.getByLabel("Gateway URL").fill("ws://gateway.test");
  await page.getByLabel("Token").fill("test-token");
  await page.getByRole("button", { name: "Connect" }).click();

  await expect(page.locator('[data-tour="chat-view"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  const assertNoErrors = () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  };
  assertNoErrors();
  return { assertNoErrors };
}

async function assertVisualHealth(page: Page): Promise<void> {
  await expectPrimaryViewNotBlank(page);
  await expectNoHorizontalOverflow(page);
  await expectNoNestedOverflow(page);
  await expectNoRawProtocolLeak(page);
  await expectControlsInViewport(page, [
    page.locator('[data-tour="chat-view"]'),
    page.locator('[data-tour="message-list"]'),
    page.locator('[data-tour="chat-input"]'),
    page.getByRole("button", { name: "Send" }),
  ]);
  const visibleDialogs = page.locator('[role="dialog"]:visible');
  if ((await visibleDialogs.count()) > 0) {
    await expectControlsInViewport(page, [visibleDialogs]);
  }
}

async function expectPrimaryViewNotBlank(page: Page): Promise<void> {
  const textLength = await page.getByRole("main").evaluate((element) => {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim().length;
  });
  expect(textLength).toBeGreaterThan(20);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNoNestedOverflow(page: Page): Promise<void> {
  const offenders = await page.getByRole("main").evaluate((main) => {
    const skippedOverflow = new Set(["auto", "scroll", "hidden", "clip"]);
    const tolerance = 16;
    return Array.from(main.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (skippedOverflow.has(style.overflowX)) return false;
        return element.scrollWidth - element.clientWidth > tolerance;
      })
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        overflow: element.scrollWidth - element.clientWidth,
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      }));
  });
  expect(offenders).toEqual([]);
}

async function expectNoRawProtocolLeak(page: Page): Promise<void> {
  const visibleText = await page.getByRole("main").evaluate((element) => element.textContent ?? "");
  expect(visibleText).not.toMatch(
    /connect\.challenge|hello-ok|"type":"(?:event|res)"|minProtocol|maxProtocol/u,
  );
}

async function expectControlsInViewport(page: Page, locators: Locator[]): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const locator of locators) {
    const box = await locator.first().boundingBox();
    expect(box).not.toBeNull();
    if (!box || !viewport) continue;
    const tolerance = 1;
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(-tolerance);
    expect(box.y).toBeGreaterThanOrEqual(-tolerance);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + tolerance);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + tolerance);
  }
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  scenarioName: string,
): Promise<void> {
  const projectName = testInfo.project.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const screenshotPath = testInfo.outputPath(
    "visual-screenshots",
    projectName,
    `${scenarioName}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`${projectName}-${scenarioName}`, {
    path: screenshotPath,
    contentType: "image/png",
  });
}
