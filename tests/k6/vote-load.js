import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "1m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.005"],
    checks: ["rate>0.995"]
  }
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export default function () {
  const response = http.get(
    `${BASE_URL}/municipios/99999/secoes/99/99/votos`
  );

  check(response, {
    "status HTTP 200": (res) => res.status === 200,
    "retorna quatro registros": (res) => {
      try {
        return JSON.parse(res.body).total === 4;
      } catch {
        return false;
      }
    }
  });

  sleep(1);
}
