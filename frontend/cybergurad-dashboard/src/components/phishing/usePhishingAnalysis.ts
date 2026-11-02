import { useCallback, useRef, useState } from "react";
import { analyzeUrl, PhishingApiError } from "../../api/phishing";
import type { PhishingAnalysis } from "../../api/phishing";

export type PhishingState =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | { status: "success"; data: PhishingAnalysis }
  | { status: "error"; url: string; message: string; httpStatus?: number };

export function usePhishingAnalysis() {
  const [state, setState] = useState<PhishingState>({ status: "idle" });
  const ctrl = useRef<AbortController | null>(null);

  const analyze = useCallback(async (url: string) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: "loading", url });
    try {
      const data = await analyzeUrl({ url, fetch_page: true, timeout: 8 }, c.signal);
      setState({ status: "success", data });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof PhishingApiError) {
        setState({ status: "error", url, message: err instanceof Error ? err.message : "Analysis failed", ...(err instanceof PhishingApiError && err.status !== undefined ? { httpStatus: err.status } : {}) });
      } else {
        setState({
          status: "error",
          url,
          message: err instanceof Error ? err.message : "Analysis failed",
        });
      }
    }
  }, []);

  return { state, analyze };
}

