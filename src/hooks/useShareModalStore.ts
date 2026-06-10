import { create } from "zustand";
interface ShareModalStore {
  isOpen: boolean;
  openShareModal: () => void;
  closeShareModal: () => void;
}

export const useShareModalStore = create<ShareModalStore>((set) => ({
  isOpen: false,
  openShareModal: () => set({ isOpen: true }),
  closeShareModal: () => set({ isOpen: false }),
}));