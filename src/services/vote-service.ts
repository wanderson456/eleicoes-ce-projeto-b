import type { VoteType } from "../domain/vote-classification.js";
import type {
  PaginatedResult,
  VoteRecord,
  VoteRepository,
  VoteSearchCriteria
} from "../domain/vote-repository.js";

const VALID_VOTE_TYPES: readonly VoteType[] = [
  "NOMINAL",
  "LEGENDA",
  "BRANCO",
  "NULO"
];

const MAX_PAGE_SIZE = 100;

export class InvalidVoteSearchCriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVoteSearchCriteriaError";
  }
}

export class VoteService {
  constructor(private readonly voteRepository: VoteRepository) {}

  async findBySection(
    criteria: VoteSearchCriteria
  ): Promise<PaginatedResult<VoteRecord>> {
    if (!/^\d{5}$/.test(criteria.municipalityCode)) {
      throw new InvalidVoteSearchCriteriaError(
        "O código do município deve conter exatamente 5 dígitos."
      );
    }

    if (!Number.isInteger(criteria.zone) || criteria.zone < 1) {
      throw new InvalidVoteSearchCriteriaError(
        "A zona eleitoral deve ser um inteiro positivo."
      );
    }

    if (!Number.isInteger(criteria.section) || criteria.section < 1) {
      throw new InvalidVoteSearchCriteriaError(
        "A seção eleitoral deve ser um inteiro positivo."
      );
    }

    if (
      criteria.voteType !== undefined &&
      !VALID_VOTE_TYPES.includes(criteria.voteType)
    ) {
      throw new InvalidVoteSearchCriteriaError(
        "O tipo de voto informado é inválido."
      );
    }

    if (!Number.isInteger(criteria.page) || criteria.page < 1) {
      throw new InvalidVoteSearchCriteriaError(
        "A página deve ser um inteiro a partir de 1."
      );
    }

    if (
      !Number.isInteger(criteria.limit) ||
      criteria.limit < 1 ||
      criteria.limit > MAX_PAGE_SIZE
    ) {
      throw new InvalidVoteSearchCriteriaError(
        `O limite deve ser um inteiro entre 1 e ${MAX_PAGE_SIZE}.`
      );
    }

    return this.voteRepository.findBySection(criteria);
  }
}
