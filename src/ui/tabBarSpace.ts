import { createContext, useContext } from 'react';

// How much a page's PageTabBar adds to the bottom safe-area inset it passes
// down (see Screen). Modals like Sheet cover the bar, so they take it back off.
export const TabBarSpace = createContext(0);
export const useTabBarSpace = () => useContext(TabBarSpace);
