import { createContext, useContext } from 'react'

export const DockContext = createContext(null)

export function useSetDock() {
  return useContext(DockContext)
}
