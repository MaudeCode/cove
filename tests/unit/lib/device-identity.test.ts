import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installDeterministicCrypto, type DeterministicCryptoFixture } from "../../helpers/crypto";
import { installStorageMocks } from "../../helpers/storage";

const restoreStorage = installStorageMocks();
const originalDateNow = Date.now;
const fixedNow = 1_700_000_000_000;

Date.now = () => fixedNow;

const {
  buildDeviceAuthPayload,
  buildDeviceConnectParams,
  clearDeviceIdentityCache,
  getDeviceDisplayName,
  getDeviceIdentity,
  setDeviceDisplayName,
} = await import("../../../src/lib/device-identity");

let cryptoFixture: DeterministicCryptoFixture;

afterAll(() => {
  Date.now = originalDateNow;
  restoreStorage();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  cryptoFixture = installDeterministicCrypto();
  clearDeviceIdentityCache();
  setDeviceDisplayName(null);
});

afterEach(() => {
  cryptoFixture.uninstall();
});

describe("device identity", () => {
  test("builds stable auth payloads with nonce-aware versioning", () => {
    expect(
      buildDeviceAuthPayload({
        deviceId: "device-1",
        clientId: "node-host",
        clientMode: "node",
        role: "node",
        scopes: ["canvas", "invoke"],
        signedAtMs: 123,
        token: "token-1",
      }),
    ).toBe("v1|device-1|node-host|node|node|canvas,invoke|123|token-1");

    expect(
      buildDeviceAuthPayload({
        deviceId: "device-1",
        clientId: "node-host",
        clientMode: "node",
        role: "node",
        scopes: [],
        signedAtMs: 123,
        token: "token-1",
        nonce: "challenge-nonce",
      }),
    ).toBe("v2|device-1|node-host|node|node||123|token-1|challenge-nonce");

    expect(
      buildDeviceAuthPayload({
        deviceId: "device-1",
        clientId: "node-host",
        clientMode: "node",
        role: "node",
        scopes: [],
        signedAtMs: 123,
        token: "token-1",
        nonce: "",
      }),
    ).toBe("v1|device-1|node-host|node|node||123|token-1");
  });

  test("signs device connect params with the gateway challenge nonce", async () => {
    const expectedDeviceId = cryptoFixture.deviceIdForSeed(1);
    const expectedPayload = `v2|${expectedDeviceId}|node-host|node|node||${fixedNow}|token-1|challenge-nonce`;

    const params = await buildDeviceConnectParams({
      clientId: "node-host",
      clientMode: "node",
      role: "node",
      token: "token-1",
      nonce: "challenge-nonce",
    });

    expect(params).toEqual({
      id: expectedDeviceId,
      publicKey: cryptoFixture.publicKeyBase64UrlForSeed(1),
      signature: cryptoFixture.signatureForPayload(1, expectedPayload),
      signedAt: fixedNow,
      nonce: "challenge-nonce",
    });
    expect(cryptoFixture.calls.signPayloads).toEqual([expectedPayload]);
  });

  test("omits empty challenge nonces from connect params", async () => {
    const expectedDeviceId = cryptoFixture.deviceIdForSeed(1);
    const expectedPayload = `v1|${expectedDeviceId}|node-host|node|node||${fixedNow}|token-1`;

    const params = await buildDeviceConnectParams({
      clientId: "node-host",
      clientMode: "node",
      role: "node",
      token: "token-1",
      nonce: "",
    });

    expect(params.nonce).toBeUndefined();
    expect(params.signature).toBe(cryptoFixture.signatureForPayload(1, expectedPayload));
  });

  test("reloads a stable identity from localStorage", async () => {
    const first = await getDeviceIdentity();

    clearDeviceIdentityCache();
    cryptoFixture.reset(2);
    const second = await getDeviceIdentity();

    expect(second.deviceId).toBe(first.deviceId);
    expect(second.publicKeyBase64Url).toBe(first.publicKeyBase64Url);
    expect(cryptoFixture.calls.generatedSeeds).toEqual([]);
  });

  test("regenerates identity when stored device id does not match the public key", async () => {
    const first = await getDeviceIdentity();
    const stored = JSON.parse(localStorage.getItem("cove:device-identity") ?? "{}");
    localStorage.setItem(
      "cove:device-identity",
      JSON.stringify({
        ...stored,
        deviceId: "corrupted-device-id",
      }),
    );

    clearDeviceIdentityCache();
    cryptoFixture.reset(2);
    const regenerated = await getDeviceIdentity();

    expect(regenerated.deviceId).not.toBe(first.deviceId);
    expect(regenerated.deviceId).toBe(cryptoFixture.deviceIdForSeed(2));
    expect(cryptoFixture.calls.generatedSeeds).toEqual([2]);
  });

  test("regenerates identity when stored public key text does not match the key material", async () => {
    const first = await getDeviceIdentity();
    const stored = JSON.parse(localStorage.getItem("cove:device-identity") ?? "{}");
    localStorage.setItem(
      "cove:device-identity",
      JSON.stringify({
        ...stored,
        publicKeyBase64Url: "corrupted-public-key",
      }),
    );

    clearDeviceIdentityCache();
    cryptoFixture.reset(2);
    const regenerated = await getDeviceIdentity();

    expect(regenerated.deviceId).not.toBe(first.deviceId);
    expect(regenerated.publicKeyBase64Url).toBe(cryptoFixture.publicKeyBase64UrlForSeed(2));
    expect(cryptoFixture.calls.generatedSeeds).toEqual([2]);
  });

  test("regenerates identity when stored private key does not match the public key", async () => {
    const first = await getDeviceIdentity();
    const stored = JSON.parse(localStorage.getItem("cove:device-identity") ?? "{}");
    localStorage.setItem(
      "cove:device-identity",
      JSON.stringify({
        ...stored,
        privateKeyJwk: {
          ...stored.privateKeyJwk,
          d: "private-2",
        },
      }),
    );

    clearDeviceIdentityCache();
    cryptoFixture.reset(3);
    const regenerated = await getDeviceIdentity();

    expect(regenerated.deviceId).not.toBe(first.deviceId);
    expect(regenerated.deviceId).toBe(cryptoFixture.deviceIdForSeed(3));
    expect(cryptoFixture.calls.generatedSeeds).toEqual([3]);
  });

  test("uses custom display names and falls back to the stable device id", async () => {
    const expectedDeviceId = cryptoFixture.deviceIdForSeed(1);

    expect(await getDeviceDisplayName()).toBe(`Cove Canvas (${expectedDeviceId.slice(0, 8)})`);

    setDeviceDisplayName("  Studio Mac  ");
    expect(await getDeviceDisplayName()).toBe("Studio Mac");

    setDeviceDisplayName(null);
    expect(await getDeviceDisplayName()).toBe(`Cove Canvas (${expectedDeviceId.slice(0, 8)})`);
  });
});
