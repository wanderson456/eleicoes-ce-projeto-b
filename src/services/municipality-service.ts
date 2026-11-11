import type {
  MunicipalityRecord,
  MunicipalityRepository
} from "../domain/municipality-repository.js";

export class MunicipalityService {
  constructor(
    private readonly repository: MunicipalityRepository
  ) {}

  async findAll(): Promise<MunicipalityRecord[]> {
    return this.repository.findAll();
  }
}
