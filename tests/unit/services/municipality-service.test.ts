
import { describe, expect, it, vi } from "vitest";
import { MunicipalityService } from "../../../src/services/municipality-service.js";
import type { MunicipalityRepository } from "../../../src/domain/municipality-repository.js";

describe("MunicipalityService", () => {
  it("returns all municipalities from repository", async () => {
    const municipalities = [
      { code: "2301307", name: "Araripe" },
      { code: "2300200", name: "Acaraú" }
    ];

    const findAll = vi.fn().mockResolvedValue(municipalities);

    const service = new MunicipalityService({
      findAll
    } as unknown as MunicipalityRepository);

    const result = await service.findAll();

    expect(findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual(municipalities);
  });

  it("propagates repository errors", async () => {
    const error = new Error("Falha ao consultar municípios");
    const findAll = vi.fn().mockRejectedValue(error);

    const service = new MunicipalityService({
      findAll
    } as unknown as MunicipalityRepository);

    await expect(service.findAll()).rejects.toThrow(error);
    expect(findAll).toHaveBeenCalledTimes(1);
  });
});
