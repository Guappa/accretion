export interface EndgameConfig {
  victoryMassGoal: number;
}

// 3x the Galactic Core threshold: the hole must outgrow the galaxy it was raised on.
export const ENDGAME: EndgameConfig = {
  victoryMassGoal: 1200000,
};
