export type LoginAuthMode = "token" | "password";

export interface ClassifiedLoginFailure {
  message: string;
  remediation?: string;
  details?: string;
}

interface LoginFailureOptions {
  authMode: LoginAuthMode;
  credential?: string;
}

type ErrorLike = {
  code?: unknown;
  details?: unknown;
  message?: unknown;
  remediation?: unknown;
};

const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /(password|passphrase|token|secret|credential|authorization|auth[-_]?header|api[-_]?key|apikey|cookie|jwt|bearer|private[-_]?key|access[-_]?key|client[-_]?secret|refresh[-_]?token)/i;
const TOKEN_PATTERN = /\b(?:tok|sk|pk|gh[pousr]|glpat|xox[baprs]|slack)_[A-Za-z0-9._-]+\b/g;
const HYPHENATED_PROVIDER_TOKEN_PATTERN =
  /\b(?:sk|pk|rk|ak|xox[baprs])-[A-Za-z0-9][A-Za-z0-9._-]{8,}\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const SENSITIVE_TEXT_VALUE_PATTERN =
  /\b(api[-_ ]?key|apikey|auth[-_ ]?header|authorization|cookie|jwt|token|secret|password|private[-_ ]?key)\s*[:=]?\s+([A-Za-z0-9_~+/=-][A-Za-z0-9._~+/=-]{10,}[A-Za-z0-9_~+/=-])/gi;

export function classifyLoginFailure(
  error: unknown,
  options: LoginFailureOptions,
): ClassifiedLoginFailure {
  const errorLike = toErrorLike(error);
  const code = stringValue(errorLike.code);
  const rawMessage = stringValue(errorLike.message) ?? stringValue(error);
  const message = redactText(rawMessage ?? "Login failed.", options.credential);
  const remediation = stringValue(errorLike.remediation);
  const details = formatDetails(errorLike.details, options.credential);
  const signature = `${code ?? ""} ${rawMessage ?? ""}`.toLowerCase();

  if (isExpiredToken(signature)) {
    return withStructuredFields(
      {
        message:
          "The saved token has expired. Generate a new operator token in OpenClaw and try again.",
      },
      remediation,
      details,
      options.credential,
    );
  }

  if (options.authMode === "password" && isCredentialRejection(code, signature)) {
    return withStructuredFields(
      {
        message: "The gateway rejected the password. Re-enter the gateway password and try again.",
      },
      remediation,
      details,
      options.credential,
    );
  }

  if (isGatewayUnavailable(signature)) {
    return withStructuredFields(
      {
        message:
          "Cove could not reach the gateway. Check that OpenClaw is running and that the WebSocket URL is reachable.",
      },
      remediation,
      details,
      options.credential,
    );
  }

  if (options.authMode === "token" && isCredentialRejection(code, signature)) {
    return withStructuredFields(
      {
        message:
          "The gateway rejected the token. Check that you pasted the current operator token and try again.",
      },
      remediation,
      details,
      options.credential,
    );
  }

  return withStructuredFields({ message }, remediation, details, options.credential);
}

function isExpiredToken(signature: string): boolean {
  return (
    signature.includes("expired") &&
    (signature.includes("token") ||
      signature.includes("jwt") ||
      signature.includes("credential") ||
      signature.includes("auth"))
  );
}

function isCredentialRejection(code: string | undefined, signature: string): boolean {
  const normalizedCode = code?.toUpperCase();
  if (normalizedCode && isAuthConfigurationCode(normalizedCode)) {
    return false;
  }

  if (
    normalizedCode &&
    [
      "AUTH_FAILED",
      "AUTH_INVALID",
      "AUTH_UNAUTHORIZED",
      "AUTH_TOKEN_INVALID",
      "AUTH_TOKEN_REJECTED",
      "AUTH_PASSWORD_INVALID",
      "AUTH_PASSWORD_REJECTED",
      "BAD_CREDENTIALS",
      "INVALID_CREDENTIALS",
      "INVALID_TOKEN",
      "INVALID_PASSWORD",
      "UNAUTHORIZED",
      "FORBIDDEN",
    ].includes(normalizedCode)
  ) {
    return true;
  }

  return (
    signature.includes("unauthorized") ||
    signature.includes("forbidden") ||
    signature.includes("authentication failed") ||
    signature.includes("login failed") ||
    signature.includes("invalid credentials") ||
    signature.includes("bad credentials") ||
    signature.includes("invalid token") ||
    signature.includes("bad token") ||
    signature.includes("token rejected") ||
    signature.includes("invalid password") ||
    signature.includes("bad password") ||
    signature.includes("password rejected") ||
    signature.includes("credential rejected")
  );
}

function isAuthConfigurationCode(code: string): boolean {
  return (
    code.startsWith("AUTH_CONFIG") ||
    code === "AUTH_DISABLED" ||
    code === "AUTH_NOT_CONFIGURED" ||
    code === "OPERATOR_AUTH_DISABLED"
  );
}

function isGatewayUnavailable(signature: string): boolean {
  return (
    signature.includes("websocket error") ||
    signature.includes("network") ||
    signature.includes("failed to fetch") ||
    signature.includes("connection failed") ||
    signature.includes("connection closed") ||
    signature.includes("connection refused") ||
    signature.includes("econnrefused") ||
    signature.includes("timed out") ||
    signature.includes("closed unexpectedly")
  );
}

function withStructuredFields(
  failure: ClassifiedLoginFailure,
  remediation: string | undefined,
  details: string | undefined,
  credential: string | undefined,
): ClassifiedLoginFailure {
  return {
    ...failure,
    details,
    remediation: remediation ? redactText(remediation, credential) : undefined,
  };
}

function toErrorLike(error: unknown): ErrorLike {
  if (isRecord(error)) {
    return error;
  }
  return {};
}

function formatDetails(details: unknown, credential: string | undefined): string | undefined {
  if (details == null) return undefined;

  const redacted = redactValue(details, credential);
  if (typeof redacted === "string") return redacted;

  try {
    return JSON.stringify(redacted, null, 2);
  } catch {
    return undefined;
  }
}

function redactValue(value: unknown, credential: string | undefined): unknown {
  if (typeof value === "string") {
    return redactText(value, credential);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, credential));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry, credential),
      ]),
    );
  }

  return value;
}

function redactText(value: string, credential: string | undefined): string {
  let redacted = value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(HYPHENATED_PROVIDER_TOKEN_PATTERN, REDACTED)
    .replace(SENSITIVE_TEXT_VALUE_PATTERN, (_match, label: string) => `${label} ${REDACTED}`)
    .replace(TOKEN_PATTERN, REDACTED);
  const trimmedCredential = credential?.trim();
  if (trimmedCredential) {
    redacted = redacted.split(trimmedCredential).join(REDACTED);
  }
  return redacted;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
