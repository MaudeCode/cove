/**
 * CanvasView
 *
 * Standalone canvas page for multi-window/monitor setups.
 * Shows canvas content in full viewport, no panel chrome.
 */

import { useEffect } from "preact/hooks";
import {
  canvasUrl,
  canvasContent,
  canvasBlobUrl,
  canvasContentType,
  announceStatus,
} from "@/lib/canvas-receiver";
import { CanvasContent } from "@/components/canvas/CanvasContent";

export function CanvasView() {
  // Broadcast that standalone canvas is open
  useEffect(() => {
    announceStatus(true);

    const handleUnload = () => announceStatus(false);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      handleUnload();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  return (
    <div class="w-screen h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <CanvasContent
        url={canvasUrl.value}
        blobUrl={canvasBlobUrl.value}
        contentType={canvasContentType.value}
        content={canvasContent.value}
        largeEmptyState
      />
    </div>
  );
}
