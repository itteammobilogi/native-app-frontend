import { createContext, useContext, useEffect, useState } from 'react';

// False while the launch intro is still animating. Heavy screens (Home) hold
// back their content until it flips, so mounting dozens of cards and images
// doesn't steal frames from the intro. Their data still loads meanwhile.
export const IntroGate = createContext(true);
export const useIntroRevealed = () => useContext(IntroGate);

// Once the intro reveals the screen, counts up from 1 to `stages`, one step
// per painted frame. A screen mounts its sections stage by stage (above the
// fold first), so no single JS frame has to build the whole page and the
// intro's fade-out and the first scroll stay smooth. 0 until revealed.
export function useRevealStage(stages: number) {
  const revealed = useIntroRevealed();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!revealed) return;
    if (stage >= stages) return;
    // Wait for the previous stage to be drawn, then queue the next one.
    let timeout: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      timeout = setTimeout(() => setStage((s) => s + 1), 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [revealed, stage, stages]);
  return stage;
}
