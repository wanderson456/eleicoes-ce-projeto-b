import type { VoteType } from "./vote-classification.js";

export interface VoteSearchCriteria {
  municipalityCode: string;
  zone: number;
  section: number;
  year: number;
  round: number;
  voteType?: VoteType;
  page: number;
  limit: number;
}
export interface VoteRecord {
  year: number;
  round: number;
  municipalityCode: string;
  municipalityName: string;
  zone: number;
  section: number;
  officeCode: number;
  officeName: string;
  voteCode: string;
  voteName: string;
  quantity: number;
  candidateId: number;
  voteType: VoteType;
  pollingPlaceCode: number;
  pollingPlaceName: string;
  pollingPlaceAddress: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VoteRepository {
  findBySection(
    criteria: VoteSearchCriteria
  ): Promise<PaginatedResult<VoteRecord>>;
}
