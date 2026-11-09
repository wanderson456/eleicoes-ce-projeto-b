import { describe, expect, it, vi } from "vitest";
import type { SectionRepository } from "../../../src/domain/section-repository.js";
import {
  InvalidSectionSearchCriteriaError,
  SectionService
} from "../../../src/services/section-service.js";

describe("SectionService", () => {
  const criteria = {
    municipalityCode: "2300200",
    page: 1,
    limit: 20
  };

  const repositoryResult = {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  };

  function createService() {
    const findByMunicipality = vi.fn().mockResolvedValue(repositoryResult);

    const repository = {
      findByMunicipality
    } as unknown as SectionRepository;

    return {
      service: new SectionService(repository),
      findByMunicipality
    };
  }

  it("delegates a valid search to the repository", async () => {
    const { service, findByMunicipality } = createService();

    const result = await service.findByMunicipality(criteria);

    expect(result).toEqual(repositoryResult);
    expect(findByMunicipality).toHaveBeenCalledWith(criteria);
  });

  it.each([
    ["municipalityCode", { municipalityCode: "230020" }],
    ["municipalityCode with letters", { municipalityCode: "23002AB" }],
    ["page", { page: 0 }],
    ["limit below minimum", { limit: 0 }],
    ["limit above maximum", { limit: 101 }],
    ["fractional page", { page: 1.5 }],
    ["fractional limit", { limit: 2.5 }]
  ])("rejects invalid criteria: %s", async (_field, override) => {
    const { service, findByMunicipality } = createService();

    await expect(
      service.findByMunicipality({ ...criteria, ...override })
    ).rejects.toBeInstanceOf(InvalidSectionSearchCriteriaError);

    expect(findByMunicipality).not.toHaveBeenCalled();
  });

  it("accepts the maximum page size", async () => {
    const { service, findByMunicipality } = createService();

    await service.findByMunicipality({
      ...criteria,
      limit: 100
    });

    expect(findByMunicipality).toHaveBeenCalledOnce();
  });
});
