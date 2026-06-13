/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { renderComponent, screen, userEvent } from "../../../helpers/dom";

mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

const { Button } = await import("../../../../src/components/ui/Button");

describe("Button", () => {
  test("renders and handles clicks in the DOM harness", async () => {
    const clicks: string[] = [];

    renderComponent(<Button onClick={() => clicks.push("clicked")}>Save</Button>);

    const button = screen.getByRole("button", { name: /Save/ });
    await userEvent.click(button);

    expect(clicks).toEqual(["clicked"]);
  });

  test("disables interaction while loading", async () => {
    const clicks: string[] = [];

    renderComponent(
      <Button loading onClick={() => clicks.push("clicked")}>
        Save
      </Button>,
    );

    const button = screen.getByRole("button", { name: /Save/ });
    await userEvent.click(button);

    expect(button).toHaveProperty("disabled", true);
    expect(clicks).toEqual([]);
  });
});
