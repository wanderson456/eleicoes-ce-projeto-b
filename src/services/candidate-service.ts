
import type {
    CandidateRepository,
    CandidateSearchCriteria,
    PaginatedCandidates,
    CandidateGeographicSearchCriteria,
    CandidateGeographicDistribution
} from "../domain/candidate-repository.js";
export class InvalidCandidateSearchCriteriaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidCandidateSearchCriteriaError";
    }
}

export class CandidateService {
    constructor(
        private readonly repository: CandidateRepository
    ) { }

    async findAll(
        criteria: CandidateSearchCriteria
    ): Promise<PaginatedCandidates> {
        if (
            !Number.isInteger(criteria.year) ||
            criteria.year < 1000 ||
            criteria.year > 9999
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Ano da eleição inválido."
            );
        }

        if (
            !Number.isInteger(criteria.round) ||
            ![1, 2].includes(criteria.round)
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Turno deve ser 1 ou 2."
            );
        }

        if (
            criteria.officeCode !== undefined &&
            (!Number.isInteger(criteria.officeCode) ||
                criteria.officeCode <= 0)
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Código do cargo deve ser um número inteiro positivo."
            );
        }

        if (
            criteria.search !== undefined &&
            (typeof criteria.search !== "string" ||
                criteria.search.trim().length > 200)
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "A busca deve ter no máximo 200 caracteres."
            );
        }

        if (
            criteria.candidateNumber !== undefined &&
            (!/^\d{1,10}$/.test(criteria.candidateNumber))
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Número do candidato deve conter de 1 a 10 dígitos."
            );
        }

        if (
            !Number.isInteger(criteria.page) ||
            criteria.page < 1
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Página deve ser um número inteiro maior ou igual a 1."
            );
        }

        if (
            !Number.isInteger(criteria.limit) ||
            criteria.limit < 1 ||
            criteria.limit > 100
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Limite deve ser um número entre 1 e 100."
            );
        }

        const normalizedSearch = criteria.search?.trim();

        const normalizedCriteria: CandidateSearchCriteria = {
            ...criteria
        };

        if (normalizedSearch) {
            normalizedCriteria.search = normalizedSearch;
        } else {
            delete normalizedCriteria.search;
        }

        return this.repository.findAll(normalizedCriteria);
    }
        async findGeographicDistribution(
        criteria: CandidateGeographicSearchCriteria
    ): Promise<CandidateGeographicDistribution | null> {
        if (
            !Number.isSafeInteger(criteria.sqCandidato) ||
            criteria.sqCandidato <= 0
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Identificador do candidato deve ser um inteiro positivo e seguro."
            );
        }

        if (
            !Number.isInteger(criteria.year) ||
            criteria.year < 1000 ||
            criteria.year > 9999
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Ano da eleição inválido."
            );
        }

        if (
            !Number.isInteger(criteria.round) ||
            ![1, 2].includes(criteria.round)
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Turno deve ser 1 ou 2."
            );
        }

        if (
            !Number.isInteger(criteria.page) ||
            criteria.page < 1
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Página deve ser um número inteiro maior ou igual a 1."
            );
        }

        if (
            !Number.isInteger(criteria.limit) ||
            criteria.limit < 1 ||
            criteria.limit > 100
        ) {
            throw new InvalidCandidateSearchCriteriaError(
                "Limite deve ser um número entre 1 e 100."
            );
        }

        return this.repository.findGeographicDistribution(criteria);
    }
}