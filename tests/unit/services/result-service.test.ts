import { describe, expect, it, vi } from "vitest";
import type { ResultRepository } from "../../../src/domain/result-repository.js";
import {
    InvalidResultSearchCriteriaError,
    ResultService
} from "../../../src/services/result-service.js";

describe("ResultService", () => {
    const criteria = {
        municipalityCode: "13250",
        year: 2022,
        round: 1
    };

    const repositoryResult = {
        municipalityCode: "13250",
        municipalityName: "ARARIPE",
        year: 2022,
        round: 1,
        offices: []
    };

    function createService() {
        const findByMunicipality = vi.fn().mockResolvedValue(repositoryResult);

        const repository = {
            findByMunicipality
        } as unknown as ResultRepository;

        return {
            service: new ResultService(repository),
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
        ["municipalityCode with 4 digits", { municipalityCode: "1325" }],
        ["municipalityCode with 6 digits", { municipalityCode: "132500" }],
        ["municipalityCode with letters", { municipalityCode: "132AB" }],
        ["year below 4 digits", { year: 999 }],
        ["year above 4 digits", { year: 10000 }],
        ["fractional year", { year: 2022.5 }],
        ["round below minimum", { round: 0 }],
        ["round above maximum", { round: 3 }],
        ["fractional round", { round: 1.5 }],
        ["officeCode below minimum", { officeCode: 0 }],
        ["fractional officeCode", { officeCode: 6.5 }]
    ])("rejects invalid criteria: %s", async (_field, override) => {
        const { service, findByMunicipality } = createService();

        await expect(
            service.findByMunicipality({ ...criteria, ...override })
        ).rejects.toBeInstanceOf(InvalidResultSearchCriteriaError);

        expect(findByMunicipality).not.toHaveBeenCalled();
    });

    it("accepts a valid officeCode", async () => {
        const { service, findByMunicipality } = createService();

        await service.findByMunicipality({
            ...criteria,
            officeCode: 7
        });

        expect(findByMunicipality).toHaveBeenCalledOnce();
    });

    it("accepts the maximum four-digit year", async () => {
        const { service, findByMunicipality } = createService();

        await service.findByMunicipality({
            ...criteria,
            year: 9999
        });

        expect(findByMunicipality).toHaveBeenCalledOnce();
    });


    it("accepts the minimum four-digit year", async () => {
        const { service, findByMunicipality } = createService();

        await service.findByMunicipality({
            ...criteria,
            year: 1000
        });

        expect(findByMunicipality).toHaveBeenCalledOnce();
    });

    it("accepts the second election round", async () => {
        const { service, findByMunicipality } = createService();

        await service.findByMunicipality({
            ...criteria,
            round: 2
        });

        expect(findByMunicipality).toHaveBeenCalledOnce();
    });

});