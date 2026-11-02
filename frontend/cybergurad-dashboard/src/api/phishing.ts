// All phishing API access lives here. Backend is the source of truth.
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

export interface PhishingModel {
  name: string;
  prediction: "phishing" | "legitimate" | string;
  prediction_class: number;
  probability: number;
  phishing_probability: number;
  feature_count: number;
}

export interface ThreatSource {
  source: string;
  status: "ok" | "unavailable" | "error" | string;
  found: boolean;
  confidence?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ThreatIntelligence {
  indicator: string;
  indicator_type: string;
  found: boolean;
  malicious: boolean;
  sources_checked: number;
  positive_sources: number;
  sources: ThreatSource[];
}

export interface RiskIndicator {
  name: string;
  reason: string;
  points: number;
}

export interface Risk {
  prediction: string;
  phishing_probability: number;
  risk_score: number;
  risk_level: string;
  severity_description: string;
  model_score: number;
  evidence_score: number;
  threat_intel_score: number;
  indicator_count: number;
  indicators: RiskIndicator[];
}

export interface Recommendation {
  priority: string;
  action: string;
  reason: string;
}

export interface Playbook {
  id: string;
  name: string;
  objective: string;
  steps: unknown[];
}

export interface ResponseAction {
  action_id: string;
  name: string;
  type: string;
  priority: string;
  requires_approval: boolean;
  status: string;
}

export interface PhishingResponseBlock {
  mode: "RECOMMEND_ONLY" | string;
  recommendations: Recommendation[];
  playbook: Playbook;
  actions: ResponseAction[];
}

export interface PhishingAnalysis {
  request_id: string;
  url: string;
  model: PhishingModel;
  threat_intelligence: ThreatIntelligence;
  risk: Risk;
  response: PhishingResponseBlock;
  features: Record<string, number | string | boolean | null>;
}

export interface AnalyzeUrlRequest {
  url: string;
  fetch_page?: boolean;
  timeout?: number;
}

export class PhishingApiError extends Error {
  status?: number;
  requestUrl: string;
  constructor(message: string, requestUrl: string, status?: number) {
    super(message);
    this.name = "PhishingApiError";
    this.status = status;
    this.requestUrl = requestUrl;
  }
}

function extractDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const d = b.detail ?? b.message ?? b.error;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: unknown }).msg)
            : JSON.stringify(e),
        )
        .join("; ");
    }
    if (d !== undefined) return JSON.stringify(d);
  }
  return fallback;
}

export async function analyzeUrl(
  req: AnalyzeUrlRequest,
  signal?: AbortSignal,
): Promise<PhishingAnalysis> {
  const endpoint = `${API_BASE_URL}/analyze/url`;
  if (import.meta.env.DEV) console.info("[phishing] POST", endpoint);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fetch_page: true, timeout: 8, ...req }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new PhishingApiError(
      `Backend unavailable: could not reach ${endpoint}`,
      endpoint,
    );
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    throw new PhishingApiError(
      extractDetail(body, `Analysis failed (HTTP ${res.status})`),
      endpoint,
      res.status,
    );
  }
  return body as PhishingAnalysis;
}

export async function checkPhishingHealth(): Promise<unknown> {
  const endpoint = `${API_BASE_URL}/analyze/url/health`;
  if (import.meta.env.DEV) console.info("[phishing] GET", endpoint);
  const res = await fetch(endpoint);
  if (!res.ok) throw new PhishingApiError(`Health check failed`, endpoint, res.status);
  return res.json();
}

// Compatibility adapter for the existing PhishingPage.
export type PhishingAnalysisResponse = PhishingAnalysis;

export async function analyzePhishingUrl(
  url: string,
  options: { fetchPage?: boolean; timeout?: number } = {},
): Promise<PhishingAnalysisResponse> {
  return analyzeUrl({
    url,
    fetch_page: options.fetchPage ?? true,
    timeout: options.timeout ?? 8,
  });
}
