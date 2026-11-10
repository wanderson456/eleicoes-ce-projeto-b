import { describe, expect, it, vi } from "vitest";
import type { VoteRepository } from "../../../src/domain/vote-repository.js";
import {
  InvalidVoteSearchCriteriaError,
  VoteService
} from "../../../src/services/vote-service.js";

describe("VoteService", () => {
  const criteria = {
    municipalityCode: "13005",
    zone: 30,
    section: 82,
    year: 2022,
    round: 1,
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
    const findBySection = vi.fn().mockResolvedValue(repositoryResult);

    const repository = {
      findBySection
    } as unknown as VoteRepository;

    return {
      service: new VoteService(repository),
      findBySection
    };
  }

  it("delegates a valid search to the repository", async () => {
    const { service, findBySection } = createService();

    const result = await service.findBySection(criteria);

    expect(result).toEqual(repositoryResult);
    expect(findBySection).toHaveBeenCalledWith(criteria);
  });

  it("accepts a valid vote type", async () => {
    const { service, findBySection } = createService();

    await service.findBySection({
      ...criteria,
      voteType: "NULO"
    });

    expect(findBySection).toHaveBeenCalledOnce();
  });

  it("accepts the second election round", async () => {
    const { service, findBySection } = createService();

    await service.findBySection({
      ...criteria,
      round: 2
    });

    expect(findBySection).toHaveBeenCalledOnce();
  });

  it.each([
    ["municipalityCode", { municipalityCode: "1234" }],
    ["zone", { zone: 0 }],
    ["section", { section: -1 }],
    ["page", { page: 0 }],
    ["year below minimum", { year: 999 }],
    ["year above maximum", { year: 10000 }],
    ["fractional year", { year: 2022.5 }],
    ["invalid round", { round: 3 }],
    ["limit below minimum", { limit: 0 }],
    ["limit above maximum", { limit: 101 }],
    ["fractional page", { page: 1.5 }],
    ["fractional limit", { limit: 2.5 }]
  ])("rejects invalid criteria: %s", async (_field, override) => {
    const { service, findBySection } = createService();

    await expect(
      service.findBySection({ ...criteria, ...override })
    ).rejects.toBeInstanceOf(InvalidVoteSearchCriteriaError);

    expect(findBySection).not.toHaveBeenCalled();
  });

  it("rejects an unsupported vote type", async () => {
    const { service, findBySection } = createService();

    await expect(
      service.findBySection({
        ...criteria,
        voteType: "INVALID" as "NULO"
      })
    ).rejects.toThrow("O tipo de voto informado é inválido.");

    expect(findBySection).not.toHaveBeenCalled();
  });
});
