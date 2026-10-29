import { createContext, useContext } from 'react';

// False while the launch intro is still animating. Heavy screens (Home) hold
// back their content until it flips, so mounting dozens of cards and images
// doesn't steal frames from the intro. Their data still loads meanwhile.
export const IntroGate = createContext(true);
export const useIntroRevealed = () => useContext(IntroGate);
