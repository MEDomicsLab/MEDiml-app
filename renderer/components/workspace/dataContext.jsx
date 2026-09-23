import { React, createContext, useCallback, useState } from "react"
import { medDataStore } from "./medDataStore"
import { useGlobalDataCompat } from "./useMEDData"

export const UUID_ROOT = "UUID_ROOT"

/**
 * @typedef {React.Context} DataContext
 * @description A context object that provides global data and data request state to its children components.
 * @see https://reactjs.org/docs/context.html
 */
const DataContext = createContext(null)

/**
 * @typedef {React.FunctionComponent} DataContextProvider
 * @description A compatibility shim over medDataStore.js for components that have not been
 * migrated to the per-id/per-type hooks in useMEDData.js yet. `globalData` is sourced from the
 * store (via useGlobalDataCompat, which re-renders on ANY workspace change - the same behavior
 * the old `globalData` React state had), and `setGlobalData` diffs its argument into the store via
 * reconcile() instead of doing a raw state replace. New code should prefer useMEDDataObject(id) /
 * useMEDDataObjectChildren(parentID) / useMEDDataObjectsByType(types) from useMEDData.js, which
 * only re-render for the slice of data they actually depend on.
 * @param {Object} props - The props for the DataContextProvider component.
 * @param {Object} props.children - The children components to wrap with the DataContext context object.
 * @returns {JSX.Element} - The DataContextProvider component.
 */
function DataContextProvider({ children }) {
  const globalData = useGlobalDataCompat()
  const [dataRequest, setDataRequest] = useState({}) // The data request object that will be used to request data from the main process

  /**
   * @deprecated prefer medDataStore's upsert/patch/remove, or the useMEDData.js hooks for reads
   * @param {Object} newGlobalData - a full `{ id -> MEDDataObject }` dict to reconcile into the store
   */
  const setGlobalData = useCallback((newGlobalData) => {
    medDataStore.reconcile(newGlobalData)
  }, [])

  /**
   * @deprecated prefer medDataStore.snapshot() (synchronous, no Promise needed)
   * @returns {Promise} - A promise that resolves with a copy of the global data object.
   */
  const copyGlobalDataSync = () => {
    return Promise.resolve({ ...medDataStore.snapshot() })
  }

  return (
    <>
      <DataContext.Provider
        value={{
          globalData,
          setGlobalData,
          dataRequest,
          setDataRequest,
          copyGlobalDataSync
        }}
      >
        {children}
      </DataContext.Provider>
    </>
  )
}

export { DataContextProvider, DataContext }
