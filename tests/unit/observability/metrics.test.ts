import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordHttpMetric, metricsHandler } from "../../../src/observability/metrics.js";

describe("Métricas HTTP", () => {
  let response: {
    type: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    response = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };
  });

  it("contabiliza requisições HTTP", () => {
    recordHttpMetric({
      method: "GET",
      route: "/health",
      status: 200,
      durationMs: 10
    });

    metricsHandler({} as never, response as never);

    expect(response.send).toHaveBeenCalled();
    expect(response.send.mock.calls[0][0]).toContain(
      'http_requests_total{method="GET",route="/health",status="200"}'
    );
  });

  it("contabiliza respostas de erro 5xx", () => {
    recordHttpMetric({
      method: "GET",
      route: "/health",
      status: 500,
      durationMs: 20
    });

    metricsHandler({} as never, response as never);

    expect(response.send.mock.calls[0][0]).toContain(
      "http_server_errors_total 1"
    );
  });

  it("calcula o percentil 95 das durações", () => {
    for (let durationMs = 1; durationMs <= 100; durationMs++) {
      recordHttpMetric({
        method: "GET",
        route: "/health",
        status: 200,
        durationMs
      });
    }

    metricsHandler({} as never, response as never);

    expect(response.send.mock.calls[0][0]).toContain(
      'http_request_duration_ms{quantile="0.95"} 95'
    );
  });
});
