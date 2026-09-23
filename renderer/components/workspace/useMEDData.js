import { useCallback, useMemo, useSyncExternalStore } from "react"
import { medDataStore } from "./medDataStore"

/**
 * @description Returns the store singleton itself - a stable reference that never triggers a
 * re-render on its own. For components/handlers that only need to READ workspace data inside a
 * callback (e.g. an onClick handler, or code that hands `dict[id]` to a MEDDataObject static),
 * this is the right hook: it subscribes to nothing, so the component never re-renders just
 * because some unrelated file changed.
 */
export function useMEDDataStore() {
  return medDataStore
}

/**
 * @description Subscribes to a single MEDDataObject by id. Re-renders only when THIS object is
 * added, changed, or removed - not when any other file in the workspace changes.
 * @param {String} id
 * @returns {Object|undefined} the current record, or undefined if it doesn't exist
 */
export function useMEDDataObject(id) {
  const subscribe = useCallback((callback) => medDataStore.subscribe(id, callback), [id])
  const getSnapshot = useCallback(() => medDataStore.get(id), [id])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * @description Subscribes to one field of a single MEDDataObject. Re-renders only when that
 * specific object changes (the store doesn't currently track per-field diffs, so this is a
 * convenience wrapper over useMEDDataObject, not a finer-grained subscription).
 * @param {String} id
 * @param {String} field
 */
export function useMEDDataObjectField(id, field) {
  const record = useMEDDataObject(id)
  return record ? record[field] : undefined
}

/**
 * @description Subscribes to the childrenIDs of one directory. Re-renders only when a child is
 * added to or removed from THIS parent - not when a sibling's own content changes, and not when
 * an unrelated directory's children change.
 * @param {String} parentID
 * @returns {ReadonlyArray<String>} array of child ids (stable reference until it actually changes)
 */
export function useMEDDataObjectChildren(parentID) {
  const subscribe = useCallback((callback) => medDataStore.subscribe(`children:${parentID}`, callback), [parentID])
  const getSnapshot = useCallback(() => medDataStore.getChildren(parentID), [parentID])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * @description Subscribes to the set of ids matching one or more MEDDataObject `type`s (e.g. the
 * accepted file extensions for a selector dropdown). Re-renders only when an object of one of
 * these types is added, removed, or changes type - not on every unrelated workspace change.
 * @param {String|Array<String>} types
 * @returns {ReadonlyArray<String>} array of matching ids (stable reference until it actually changes)
 */
export function useMEDDataObjectsByType(types) {
  const key = Array.isArray(types) ? types.slice().sort().join(",") : types
  const subscribeKeys = useMemo(() => (Array.isArray(types) ? types : [types]).map((type) => `type:${type}`), [key])
  const subscribe = useCallback(
    (callback) => {
      const unsubscribers = subscribeKeys.map((subscribeKey) => medDataStore.subscribe(subscribeKey, callback))
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
    },
    [subscribeKeys]
  )
  const getSnapshot = useCallback(() => medDataStore.getIdsByType(types), [key])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * @description Legacy-shaped full `{ id -> MEDDataObject }` dict, for code that hasn't been
 * migrated to the per-id/per-type hooks above yet (see dataContext.jsx). Subscribes to every
 * change in the store, so components using this re-render exactly like they did with the old
 * `globalData` Context value - this hook exists to make migration incremental, not as the
 * long-term way to read workspace data.
 */
export function useGlobalDataCompat() {
  const subscribe = useCallback((callback) => medDataStore.subscribe("*", callback), [])
  const getSnapshot = useCallback(() => medDataStore.snapshot(), [])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
