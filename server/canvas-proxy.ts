/**
 * Canvas Proxy - shared logic for dev and production servers
 *
 * Proxies /canvas-proxy/* requests to the local gateway's canvas host.
 */

export const CANVAS_PROXY_PATH = "/canvas-proxy";

export interface CanvasProxyConfig {
  gatewayHost: string;
  gatewayPort: string;
}

export function getDefaultConfig(): CanvasProxyConfig {
  return {
    gatewayHost: process.env.GATEWAY_HOST || process.env.VITE_GATEWAY_HOST || "127.0.0.1",
    gatewayPort: process.env.GATEWAY_PORT || process.env.VITE_GATEWAY_PORT || "18789",
  };
}

/**
 * Handle a canvas proxy request
 * @param requestPath - The path after /canvas-proxy (e.g., "/image.png")
 * @param config - Proxy configuration
 * @returns Response to send back
 */
export async function handleCanvasProxy(
  requestPath: string,
  config: CanvasProxyConfig = getDefaultConfig(),
): Promise<Response> {
  const targetUrl = `http://${config.gatewayHost}:${config.gatewayPort}/__openclaw__/canvas${requestPath}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new Response(await response.text(), {
        status: response.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Canvas proxy error:", err);
    return new Response(`Canvas proxy error: ${err}`, { status: 502 });
  }
}
