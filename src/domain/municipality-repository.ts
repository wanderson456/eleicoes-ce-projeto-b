export interface MunicipalityRecord {
  tseCode: string;
  tseName: string;
  ibgeCode: string;
  ibgeName: string;
}

export interface MunicipalityRepository {
  findAll(): Promise<MunicipalityRecord[]>;
}
