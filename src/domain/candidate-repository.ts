
export interface CandidateSearchCriteria {
  year: number;
  round: number;
  officeCode?: number;
  search?: string;
  candidateNumber?: string;
  page: number;
  limit: number;
}

export interface CandidateRecord {
  id: number;
  candidateNumber: string | null;
  candidateName: string;
  ballotName: string | null;
  officeCode: number;
  officeName: string;
  partyNumber: number | null;
  partyAbbreviation: string | null;
  partyName: string | null;
  totalVotes: number;
}

export interface PaginatedCandidates {
  items: CandidateRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CandidateRepository {
  findAll(
    criteria: CandidateSearchCriteria
  ): Promise<PaginatedCandidates>;
}
