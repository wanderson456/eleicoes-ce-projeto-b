import type { PaginatedResult } from "./vote-repository.js";

export type { PaginatedResult } from "./vote-repository.js";

export interface SectionSearchCriteria {
  municipalityCode: string;
  year: number;
  page: number;
  limit: number;
}

export interface SectionRecord {
  municipalityCode: string;
  zone: number;
  section: number;
  latitude: number | null;
  longitude: number | null;
}

export interface SectionRepository {
  findByMunicipality(
    criteria: SectionSearchCriteria
  ): Promise<PaginatedResult<SectionRecord>>;
}
