export type VoteType = "NOMINAL" | "LEGENDA" | "BRANCO" | "NULO";

export function classifyVote(
  candidateId: number,
  voteCode: string
): VoteType {
  if (candidateId === -3) {
    return "LEGENDA";
  }

  if (voteCode === "95") {
    return "BRANCO";
  }

  if (voteCode === "96") {
    return "NULO";
  }

  if (candidateId > 0) {
    return "NOMINAL";
  }

  throw new Error("Não foi possível classificar o tipo de voto.");
}
