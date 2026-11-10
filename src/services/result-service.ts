
import type {
  MunicipalityResult,
  ResultRepository,
  ResultSearchCriteria
} from "../domain/result-repository.js";

export class InvalidResultSearchCriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResultSearchCriteriaError";
  }
}

export class ResultService {
  constructor(private readonly resultRepository: ResultRepository) {}

  async findByMunicipality(
    criteria: ResultSearchCriteria
  ): Promise<MunicipalityResult | null> {
    if (!/^\d{5}$/.test(criteria.municipalityCode)) {
      throw new InvalidResultSearchCriteriaError(
        "O código TSE do município deve conter exatamente 5 dígitos."
      );
    }

    if (
      !Number.isInteger(criteria.year) ||
      criteria.year < 1000 ||
      criteria.year > 9999
    ) {
      throw new InvalidResultSearchCriteriaError(
        "O ano da eleição deve conter quatro dígitos."
      );
    }

    if (
      !Number.isInteger(criteria.round) ||
      criteria.round < 1 ||
      criteria.round > 2
    ) {
      throw new InvalidResultSearchCriteriaError(
        "O turno deve ser 1 ou 2."
      );
    }

    if (
      criteria.officeCode !== undefined &&
      (!Number.isInteger(criteria.officeCode) || criteria.officeCode < 1)
    ) {
      throw new InvalidResultSearchCriteriaError(
        "O código do cargo deve ser um inteiro positivo."
      );
    }

    return this.resultRepository.findByMunicipality(criteria);
  }
}
