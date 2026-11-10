import type {
  PaginatedResult,
  SectionRecord,
  SectionRepository,
  SectionSearchCriteria
} from "../domain/section-repository.js";

const MAX_PAGE_SIZE = 100;

export class InvalidSectionSearchCriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSectionSearchCriteriaError";
  }
}

export class SectionService {
  constructor(private readonly sectionRepository: SectionRepository) { }

  async findByMunicipality(
    criteria: SectionSearchCriteria
  ): Promise<PaginatedResult<SectionRecord>> {
    if (!/^\d{7}$/.test(criteria.municipalityCode)) {
      throw new InvalidSectionSearchCriteriaError(
        "O código IBGE do município deve conter exatamente 7 dígitos."
      );
    }

    if (
      !Number.isInteger(criteria.year) ||
      criteria.year < 1000 ||
      criteria.year > 9999
    ) {
      throw new InvalidSectionSearchCriteriaError(
        "O ano da eleição deve conter quatro dígitos."
      );
    }

    if (!Number.isInteger(criteria.page) || criteria.page < 1) {
      throw new InvalidSectionSearchCriteriaError(
        "A página deve ser um inteiro a partir de 1."
      );
    }

    if (
      !Number.isInteger(criteria.limit) ||
      criteria.limit < 1 ||
      criteria.limit > MAX_PAGE_SIZE
    ) {
      throw new InvalidSectionSearchCriteriaError(
        `O limite deve ser um inteiro entre 1 e ${MAX_PAGE_SIZE}.`
      );
    }

    return this.sectionRepository.findByMunicipality(criteria);

  }
}
