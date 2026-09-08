import { create } from "zustand";
import type { ElectionPayload, GeographySpec } from "./types";

export type CustomBundle = {
  election: ElectionPayload;
  geography: GeographySpec;
  geoData?: unknown;
};

type ElectionStore = {
  custom: CustomBundle[];
  addCustom: (bundle: CustomBundle) => void;
  removeCustom: (id: string) => void;
};

export const useElectionStore = create<ElectionStore>((set) => ({
  custom: [],
  addCustom: (bundle) =>
    set((s) => ({
      custom: [bundle, ...s.custom.filter((c) => c.election.id !== bundle.election.id)],
    })),
  removeCustom: (id) => set((s) => ({ custom: s.custom.filter((c) => c.election.id !== id) })),
}));
