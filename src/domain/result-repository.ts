
export interface ResultSearchCriteria {
  municipalityCode: string;
  year: number;
  round: number;
  officeCode?: number;
}

export interface CandidateResult {
  candidateId: number;
  candidateNumber: string;
  candidateName: string;
  partyNumber: number | null;
  partyAbbreviation: string | null;
  partyName: string | null;
  votes: number;
  percentage: number;
}

export interface PartyResult {
  partyNumber: number;
  partyAbbreviation: string | null;
  partyName: string | null;
  nominalVotes: number;
  legendVotes: number;
  totalVotes: number;
  percentage: number;
}

export interface OfficeResult {
  officeCode: number;
  officeName: string;
  totalVotes: number;
  validVotes: number;
  nominalVotes: number;
  legendVotes: number;
  blankVotes: number;
  nullVotes: number;
  candidates: CandidateResult[];
  parties: PartyResult[];
}

export interface MunicipalityResult {
  municipalityCode: string;
  municipalityName: string;
  year: number;
  round: number;
  offices: OfficeResult[];
}

export interface ResultRepository {
  findByMunicipality(
    criteria: ResultSearchCriteria
  ): Promise<MunicipalityResult | null>;
}
