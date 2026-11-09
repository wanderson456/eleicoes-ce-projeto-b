import type { Request, Response } from "express";

type HttpMetric = {
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

const requests = new Map<string, number>();
const durations: number[] = [];
const MAX_DURATION_SAMPLES = 10_000;

let totalRequests = 0;
let serverErrors = 0;
let totalDurationMs = 0;

export function recordHttpMetric(metric: HttpMetric): void {
  const key = `${metric.method}|${metric.route}|${metric.status}`;

  requests.set(key, (requests.get(key) ?? 0) + 1);
  totalRequests++;
  totalDurationMs += metric.durationMs;

  if (metric.status >= 500) {
    serverErrors++;
  }

  durations.push(metric.durationMs);

  if (durations.length > MAX_DURATION_SAMPLES) {
    durations.shift();
  }
}

function calculatePercentile(percentile: number): number {
  if (durations.length === 0) {
    return 0;
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const index = Math.ceil(percentile * sorted.length) - 1;

  return sorted[Math.max(0, index)] ?? 0;
}

export function metricsHandler(_request: Request, response: Response): void {
  const lines = [
    "# HELP http_requests_total Total de requisições HTTP.",
    "# TYPE http_requests_total counter"
  ];

  for (const [key, count] of requests.entries()) {
    const [method, route, status] = key.split("|");

    lines.push(
      `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`
    );
  }

  lines.push(
    "# HELP http_server_errors_total Total de respostas HTTP 5xx.",
    "# TYPE http_server_errors_total counter",
    `http_server_errors_total ${serverErrors}`,
    "# HELP http_request_duration_ms Latência das requisições HTTP em milissegundos.",
    "# TYPE http_request_duration_ms summary",
    `http_request_duration_ms{quantile="0.95"} ${calculatePercentile(0.95)}`,
    `http_request_duration_ms_count ${totalRequests}`,
    `http_request_duration_ms_sum ${totalDurationMs}`
  );

  response
    .type("text/plain; version=0.0.4; charset=utf-8")
    .send(`${lines.join("\n")}\n`);
}