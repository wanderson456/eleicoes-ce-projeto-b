
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



export interface CandidateGeographicSearchCriteria {
  sqCandidato: number;
  year: number;
  round: number;
  page: number;
  limit: number;
}

export interface MunicipalityVoteDistribution {
  ibgeCode: string;
  municipality: string;
  votes: number;
  latitude: number | null;
  longitude: number | null;
}

export interface CandidateGeographicDistribution {
  sqCandidato: number;
  year: number;
  round: number;
  municipalities: MunicipalityVoteDistribution[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  
}
export interface CandidateRepository {
  findAll(
    criteria: CandidateSearchCriteria
  ): Promise<PaginatedCandidates>;

  findGeographicDistribution(
    criteria: CandidateGeographicSearchCriteria
  ): Promise<CandidateGeographicDistribution | null>;
}