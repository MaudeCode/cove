type TestCryptoKey = {
  kind: "private" | "public";
  raw: Uint8Array;
  seed: number;
};

interface DeterministicCryptoCalls {
  generatedSeeds: number[];
  signPayloads: string[];
}

export interface DeterministicCryptoFixture {
  calls: DeterministicCryptoCalls;
  publicKeyBase64UrlForSeed: (seed: number) => string;
  deviceIdForSeed: (seed: number) => string;
  signatureForPayload: (seed: number, payload: string) => string;
  reset: (nextSeed?: number) => void;
  uninstall: () => void;
}

export function installDeterministicCrypto(startSeed = 1): DeterministicCryptoFixture {
  const originalCrypto = globalThis.crypto;
  const calls: DeterministicCryptoCalls = {
    generatedSeeds: [],
    signPayloads: [],
  };
  let nextSeed = startSeed;

  const subtle = {
    async generateKey(): Promise<CryptoKeyPair> {
      const seed = nextSeed++;
      calls.generatedSeeds.push(seed);
      return {
        privateKey: createKey(seed, "private") as unknown as CryptoKey,
        publicKey: createKey(seed, "public") as unknown as CryptoKey,
      };
    },
    async exportKey(format: KeyFormat, key: CryptoKey): Promise<ArrayBuffer | JsonWebKey> {
      const testKey = key as unknown as TestCryptoKey;
      if (format === "raw") {
        return copyArrayBuffer(testKey.raw);
      }
      if (format === "jwk") {
        return {
          kty: "OKP",
          crv: "Ed25519",
          x: base64UrlEncode(testKey.raw),
          ...(testKey.kind === "private" ? { d: `private-${testKey.seed}` } : {}),
        };
      }
      throw new Error(`Unsupported export format: ${format}`);
    },
    async importKey(
      format: KeyFormat,
      keyData: JsonWebKey,
      _algorithm: AlgorithmIdentifier,
      _extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey> {
      if (format !== "jwk") {
        throw new Error(`Unsupported import format: ${format}`);
      }
      const raw = base64UrlDecode(String(keyData.x ?? ""));
      const seed = keyData.d ? Number(String(keyData.d).replace("private-", "")) : raw[0];
      return {
        kind: keyUsages.includes("sign") ? "private" : "public",
        raw,
        seed,
      } as unknown as CryptoKey;
    },
    async digest(_algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
      return copyArrayBuffer(fakeDigest(new Uint8Array(data as ArrayBuffer)));
    },
    async sign(
      _algorithm: AlgorithmIdentifier,
      key: CryptoKey,
      data: BufferSource,
    ): Promise<ArrayBuffer> {
      const payload = new TextDecoder().decode(data as ArrayBuffer);
      const seed = (key as unknown as TestCryptoKey).seed;
      calls.signPayloads.push(payload);
      return copyArrayBuffer(new TextEncoder().encode(signatureText(seed, payload)));
    },
    async verify(
      _algorithm: AlgorithmIdentifier,
      key: CryptoKey,
      signature: BufferSource,
      data: BufferSource,
    ): Promise<boolean> {
      const payload = new TextDecoder().decode(data as ArrayBuffer);
      const seed = (key as unknown as TestCryptoKey).seed;
      const expected = new TextEncoder().encode(signatureText(seed, payload));
      const actual = new Uint8Array(signature as ArrayBuffer);
      return byteEquals(actual, expected);
    },
  };

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      ...originalCrypto,
      subtle: subtle as unknown as SubtleCrypto,
    },
  });

  return {
    calls,
    publicKeyBase64UrlForSeed(seed: number) {
      return base64UrlEncode(rawKeyForSeed(seed));
    },
    deviceIdForSeed(seed: number) {
      return hex(fakeDigest(rawKeyForSeed(seed)));
    },
    signatureForPayload(seed: number, payload: string) {
      return base64UrlEncode(new TextEncoder().encode(signatureText(seed, payload)));
    },
    reset(seed = startSeed) {
      nextSeed = seed;
      calls.generatedSeeds = [];
      calls.signPayloads = [];
    },
    uninstall() {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    },
  };
}

function createKey(seed: number, kind: TestCryptoKey["kind"]): TestCryptoKey {
  return {
    kind,
    raw: rawKeyForSeed(seed),
    seed,
  };
}

function rawKeyForSeed(seed: number): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_value, index) => (seed + index) & 0xff);
}

function fakeDigest(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(
    { length: 32 },
    (_value, index) => (bytes[index % bytes.length] + index) & 0xff,
  );
}

function signatureText(seed: number, payload: string): string {
  return `sig:${seed}:${payload}`;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes);
  return copy.buffer;
}

function byteEquals(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return left.every((byte, index) => byte === right[index]);
}
