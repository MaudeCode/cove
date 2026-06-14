/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { createQueryParamMock } from "../../../helpers/module-mocks";
import { installUiMocks } from "../../../helpers/ui-mocks";
import type {
  ClawHubListResponse,
  ClawHubSearchResponse,
  ClawHubSkill,
  ClawHubSort,
} from "../../../../src/lib/clawhub";

const queryParamMock = createQueryParamMock({ initFromParam: true, syncUrl: true });
const toastMessages: Array<[string, string]> = [];
const listCalls: Array<{ cursor?: string; limit?: number; sort?: ClawHubSort }> = [];
const searchCalls: Array<{ limit?: number; query: string }> = [];
const getCalls: string[] = [];
const openCalls: Array<[string | URL | undefined, string | undefined]> = [];

let importCounter = 0;
let listHandler: (options?: {
  cursor?: string;
  limit?: number;
  sort?: ClawHubSort;
}) => Promise<ClawHubListResponse>;
let searchHandler: (query: string, options?: { limit?: number }) => Promise<ClawHubSearchResponse>;
let getHandler: (slug: string) => Promise<ClawHubSkill | null>;
const originalOpen = window.open;

installI18nMock();
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/hooks/useQueryParam", () => queryParamMock);
mock.module("@/lib/clawhub", () => ({
  getSkill: (slug: string) => {
    getCalls.push(slug);
    return getHandler(slug);
  },
  listSkills: (options?: { cursor?: string; limit?: number; sort?: ClawHubSort }) => {
    listCalls.push({ ...options });
    return listHandler(options);
  },
  searchSkills: (query: string, options?: { limit?: number }) => {
    searchCalls.push({ limit: options?.limit, query });
    return searchHandler(query, options);
  },
}));
installUiMocks({
  "@/components/ui/HintBox": () => ({
    HintBox: ({ children }: { children?: ComponentChildren }) => <div role="alert">{children}</div>,
  }),
  "@/components/ui/Modal": () => ({
    Modal: ({
      children,
      footer,
      open,
      title,
    }: {
      children?: ComponentChildren;
      footer?: ComponentChildren;
      open: boolean;
      title?: string;
    }) =>
      open ? (
        <section aria-label={title} role="dialog">
          {children}
          {footer && <footer>{footer}</footer>}
        </section>
      ) : null,
  }),
  "@/components/ui/Toast": () => ({
    toast: {
      error: (message: string) => toastMessages.push(["error", message]),
      success: (message: string) => toastMessages.push(["success", message]),
    },
  }),
});

beforeEach(() => {
  document.body.replaceChildren();
  queryParamMock.reset();
  window.history.replaceState({}, "", "http://localhost/skills");
  toastMessages.length = 0;
  listCalls.length = 0;
  searchCalls.length = 0;
  getCalls.length = 0;
  openCalls.length = 0;
  window.open = ((url?: string | URL, target?: string) => {
    openCalls.push([url, target]);
    return null;
  }) as typeof window.open;
  listHandler = async (options) =>
    options?.sort === "trending" ? { items: [skill("trend", "Trending Skill")] } : { items: [] };
  searchHandler = async () => ({ items: [] });
  getHandler = async () => null;
});

afterEach(() => {
  window.open = originalOpen;
});

describe("ClawHubBrowser", () => {
  test("loads trending and listed skills, preserves URL detail state, and guards pagination", async () => {
    const nextPage = deferred<ClawHubListResponse>();
    listHandler = async (options) => {
      if (options?.sort === "trending") {
        return { items: [skill("trend", "Trending Skill")] };
      }
      if (options?.cursor === "next") {
        return nextPage.promise;
      }
      return { items: [skill("alpha", "Alpha Skill")], nextCursor: "next" };
    };
    window.history.replaceState({}, "", "http://localhost/skills?hub_skill=alpha");
    const { ClawHubBrowser } = await importClawHubBrowser();

    renderComponent(<ClawHubBrowser />);

    await waitFor(() => expect(screen.getByText("Alpha Skill")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Alpha Skill" })).toBeTruthy());
    expect(window.location.search).toBe("?hub_skill=alpha");
    expect(listCalls).toContainEqual({ limit: 6, sort: "trending" });
    expect(listCalls).toContainEqual({ cursor: undefined, limit: 20, sort: "downloads" });

    const showMore = screen.getByRole("button", { name: "actions.showMore" });
    fireEvent.click(showMore);
    fireEvent.click(showMore);

    expect(listCalls.filter((call) => call.cursor === "next")).toHaveLength(1);

    nextPage.resolve({ items: [skill("beta", "Beta Skill")] });
    await waitFor(() => expect(screen.getByText("Beta Skill")).toBeTruthy());

    window.history.replaceState({}, "", "http://localhost/skills");
    window.dispatchEvent(new Event("popstate"));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Alpha Skill" })).toBeNull());
    expect(window.location.search).toBe("");
  });

  test("debounces search, enriches results, opens detail actions, and reports unsupported install", async () => {
    listHandler = async (options) =>
      options?.sort === "trending" ? { items: [] } : { items: [skill("initial", "Initial Skill")] };
    searchHandler = async (query) => ({ items: [skill("cool/skill", `Search ${query}`)] });
    getHandler = async (slug) =>
      slug === "cool/skill"
        ? skill("cool/skill", "Cool Skill", {
            latestVersion: { changelog: "Fixed things", createdAt: 20, version: "2.0.0" },
            owner: {
              displayName: "Ada",
              handle: "ada",
              image: "",
            },
            stats: {
              comments: 3,
              downloads: 4200,
              installsCurrent: 9,
              stars: 7,
              versions: 2,
            },
          })
        : null;
    const { ClawHubBrowser } = await importClawHubBrowser();

    renderComponent(<ClawHubBrowser />);
    await waitFor(() => expect(screen.getByText("Initial Skill")).toBeTruthy());

    fireEvent.input(screen.getByPlaceholderText("skills.clawhub.searchPlaceholder"), {
      target: { value: "cool" },
    });

    await waitFor(() => expect(screen.getByText("Cool Skill")).toBeTruthy());
    expect(searchCalls).toContainEqual({ limit: 20, query: "cool" });
    expect(getCalls).toContain("cool/skill");
    expect(screen.getByText("4.2k")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "skills.clawhub.install" })[0]);
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Cool Skill" })).toBeTruthy());
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get("hub_q")).toBe("cool");
      expect(params.get("hub_skill")).toBe("cool/skill");
    });

    fireEvent.click(screen.getByRole("button", { name: "ClawHub" }));
    expect(openCalls).toEqual([["https://clawhub.ai/skills/cool%2Fskill", "_blank"]]);

    fireEvent.click(screen.getAllByRole("button", { name: "skills.clawhub.install" })[1]);
    expect(toastMessages).toContainEqual([
      "error",
      'skills.clawhub.notYetSupported:{"slug":"cool/skill"}',
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cool Skill" })).toBeNull());
    const params = new URLSearchParams(window.location.search);
    expect(params.get("hub_q")).toBe("cool");
    expect(params.get("hub_skill")).toBeNull();
  });
});

async function importClawHubBrowser(): Promise<
  typeof import("../../../../src/components/skills/ClawHubBrowser")
> {
  // @ts-ignore Query suffix gives each test fresh component module state.
  return import(`../../../../src/components/skills/ClawHubBrowser.tsx?unit=${importCounter++}`);
}

function skill(
  slug: string,
  displayName: string,
  overrides: Partial<ClawHubSkill> = {},
): ClawHubSkill {
  return {
    createdAt: 10,
    displayName,
    latestVersion: { changelog: "", createdAt: 10, version: "1.0.0" },
    owner: undefined,
    slug,
    stats: { comments: 0, downloads: 12, stars: 1, versions: 1 },
    summary: `${displayName} summary`,
    tags: { latest: "1.0.0" },
    updatedAt: 10,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}
