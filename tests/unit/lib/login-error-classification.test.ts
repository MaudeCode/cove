import { describe, expect, test } from "bun:test";
import { classifyLoginFailure } from "../../../src/lib/login-error-classification";

describe("login error classification", () => {
  test("classifies expired token failures and redacts the credential", () => {
    const failure = classifyLoginFailure(
      Object.assign(new Error("Token tok_expired_secret expired"), {
        code: "AUTH_TOKEN_EXPIRED",
      }),
      { authMode: "token", credential: "tok_expired_secret" },
    );

    expect(failure).toEqual({
      message:
        "The saved token has expired. Generate a new operator token in OpenClaw and try again.",
      details: undefined,
      remediation: undefined,
    });
    expect(JSON.stringify(failure)).not.toContain("tok_expired_secret");
  });

  test("classifies password auth rejections", () => {
    expect(
      classifyLoginFailure(new Error("Authentication failed: invalid password"), {
        authMode: "password",
        credential: "password-secret",
      }).message,
    ).toBe("The gateway rejected the password. Re-enter the gateway password and try again.");
  });

  test("classifies token auth rejections without echoing the token", () => {
    const failure = classifyLoginFailure(
      Object.assign(new Error("Authentication failed for token tok_rejected_secret"), {
        code: "AUTH_FAILED",
      }),
      { authMode: "token", credential: "tok_rejected_secret" },
    );

    expect(failure.message).toBe(
      "The gateway rejected the token. Check that you pasted the current operator token and try again.",
    );
    expect(JSON.stringify(failure)).not.toContain("tok_rejected_secret");
  });

  test("classifies connection closed as gateway unavailable", () => {
    expect(
      classifyLoginFailure(new Error("Connection closed"), {
        authMode: "token",
        credential: "tok_network",
      }).message,
    ).toBe(
      "Cove could not reach the gateway. Check that OpenClaw is running and that the WebSocket URL is reachable.",
    );
  });

  test("preserves structured auth configuration errors as gateway messages", () => {
    const failure = classifyLoginFailure(
      Object.assign(new Error("Authentication failed: operator auth is disabled"), {
        code: "AUTH_CONFIG_DISABLED",
        remediation: "Enable operator auth in the gateway config.",
      }),
      { authMode: "token", credential: "tok_config_secret" },
    );

    expect(failure.message).toBe("Authentication failed: operator auth is disabled");
    expect(failure.remediation).toBe("Enable operator auth in the gateway config.");
  });

  test("preserves structured remediation and redacts sensitive details", () => {
    const failure = classifyLoginFailure(
      Object.assign(new Error("Auth is disabled for token tok_structured_secret"), {
        code: "AUTH_CONFIG_DISABLED",
        details: {
          configPath: "/tmp/openclaw.json",
          password: "password-secret",
          token: "tok_structured_secret",
        },
        remediation: "Enable operator auth for token tok_structured_secret.",
      }),
      { authMode: "token", credential: "tok_structured_secret" },
    );

    expect(failure.remediation).toBe("Enable operator auth for token [redacted].");
    expect(failure.details).toContain('"configPath": "/tmp/openclaw.json"');
    expect(failure.details).toContain('"password": "[redacted]"');
    expect(failure.details).toContain('"token": "[redacted]"');
    expect(JSON.stringify(failure)).not.toContain("tok_structured_secret");
    expect(JSON.stringify(failure)).not.toContain("password-secret");
  });

  test("redacts common bearer, provider token, and api key shapes", () => {
    const failure = classifyLoginFailure(
      Object.assign(
        new Error("Gateway rejected Bearer eyJabc.def.ghi and API key sk-proj-live_secret"),
        {
          details: {
            apiKey: "api-key-secret",
            nested: {
              authHeader: "Bearer eyJheader.payload.signature",
              publicHint: "retry after rotation",
            },
          },
          remediation:
            "Rotate ghp_provider_secret, sk-ant-api03-secretvalue, and apiKey plainsecretvalue.",
        },
      ),
      { authMode: "token", credential: "tok_unused" },
    );

    const serialized = JSON.stringify(failure);
    expect(serialized).not.toContain("eyJabc.def.ghi");
    expect(serialized).not.toContain("eyJheader.payload.signature");
    expect(serialized).not.toContain("ghp_provider_secret");
    expect(serialized).not.toContain("sk-proj-live_secret");
    expect(serialized).not.toContain("sk-ant-api03-secretvalue");
    expect(serialized).not.toContain("plainsecretvalue");
    expect(serialized).not.toContain("api-key-secret");
    expect(failure.details).toContain('"apiKey": "[redacted]"');
    expect(failure.details).toContain('"authHeader": "[redacted]"');
    expect(failure.details).toContain('"publicHint": "retry after rotation"');
    expect(failure.remediation).toBe("Rotate [redacted], [redacted], and apiKey [redacted].");
  });
});
