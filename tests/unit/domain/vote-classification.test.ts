import { describe, expect, it } from "vitest";
import { classifyVote } from "../../../src/domain/vote-classification.js";

describe("classifyVote", () => {
  it("classifies a candidate vote as NOMINAL", () => {
    expect(classifyVote(123456789, "10")).toBe("NOMINAL");
  });

  it("classifies a party vote as LEGENDA", () => {
    expect(classifyVote(-3, "10")).toBe("LEGENDA");
  });

  it("classifies a blank vote as BRANCO", () => {
    expect(classifyVote(-1, "95")).toBe("BRANCO");
  });

  it("classifies a null vote as NULO", () => {
    expect(classifyVote(-1, "96")).toBe("NULO");
  });

  it("rejects an unknown vote classification", () => {
    expect(() => classifyVote(-1, "10")).toThrow(
      "Não foi possível classificar o tipo de voto."
    );
  });

  it("rejects candidate identifier zero", () => {
    expect(() => classifyVote(0, "10")).toThrow(
      "Não foi possível classificar o tipo de voto."
    );
  });

  it("rejects an unknown negative candidate identifier", () => {
    expect(() => classifyVote(-2, "10")).toThrow(
      "Não foi possível classificar o tipo de voto."
    );
  });

  it("prioritizes the special blank and null vote codes", () => {
    expect(classifyVote(123456789, "95")).toBe("BRANCO");
    expect(classifyVote(123456789, "96")).toBe("NULO");
  });
});
