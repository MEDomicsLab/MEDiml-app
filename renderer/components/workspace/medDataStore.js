/**
 * @description A small, dependency-free external store for MEDDataObject metadata, built on
 * useSyncExternalStore (see useMEDData.js for the hooks). It replaces holding the entire
 * workspace in one React useState/Context value (the old `globalData`): listeners here are keyed
 * per entity - an id, a parent's children list, or a type - so a single change notifies the 2-3
 * subscribers that actually depend on it, instead of re-rendering every consumer of one
 * monolithic dict.
 *
 * This is a plain JS module singleton, not a React hook, so it can be read and written from
 * non-component code (MEDDataObject's static methods, IPC listeners) without a hook or a Context
 * value threaded through.
 *
 * IMPORTANT - migration note: records are intentionally NOT frozen yet. A lot of existing code
 * (MEDDataObject.rename/move/lockMedDataObject/..., dropzoneComponent.jsx) still mutates a
 * MEDDataObject's fields in place (e.g. `dataObject.path = newPath`) rather than going through
 * patch()/upsert(), relying on MEDDataObject.updateWorkspaceDataObject() (-> touchAll() below) to
 * signal "something changed, please re-render" afterwards. Freezing records would break that
 * pattern outright. Once those mutators are migrated to call patch()/move()/remove() directly
 * (a later, separate step), records should be frozen here to make direct mutation fail loudly.
 */

const objects = new Map() // id -> MEDDataObject-shaped record
const listeners = new Map() // key -> Set<callback>; key is an id, `children:<parentID>`, `type:<type>`, or "*"

const childrenCache = new Map() // parentID -> frozen string[] of childrenIDs
const typeListCache = new Map() // sorted,joined type key -> frozen string[] of ids
const typeListDependents = new Map() // type -> Set of typeListCache keys that include it

let cachedSnapshot = null
let snapshotDirty = true

let batchDepth = 0
let dirtyKeys = new Set()

function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key).add(callback)
  return () => {
    const set = listeners.get(key)
    if (!set) return
    set.delete(callback)
    if (set.size === 0) listeners.delete(key)
  }
}

function notify(key) {
  const set = listeners.get(key)
  if (!set) return
  for (const callback of set) {
    try {
      callback()
    } catch (err) {
      console.error(`medDataStore listener for "${key}" failed:`, err)
    }
  }
}

function markDirty(key) {
  if (key === "*") {
    snapshotDirty = true
  }
  if (batchDepth > 0) {
    dirtyKeys.add(key)
  } else {
    notify(key)
  }
}

/**
 * @description Runs `fn`, deferring all notifications until it returns, so applying many changes
 * (e.g. reconcile() diffing hundreds of objects) fires each affected listener at most once.
 */
function batch(fn) {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      const keys = dirtyKeys
      dirtyKeys = new Set()
      for (const key of keys) notify(key)
    }
  }
}

function invalidateTypeCachesFor(type) {
  if (!type) return
  const deps = typeListDependents.get(type)
  if (!deps) return
  for (const key of deps) typeListCache.delete(key)
  typeListDependents.delete(type)
}

/**
 * @description Sets/replaces the record for `id` and marks every derived view that could be
 * affected (the record itself, its old/new parent's children list, its old/new type list, and the
 * global "*" snapshot) dirty. Used by upsert/patch - never call directly from outside the module.
 */
function setInternal(id, nextRecord) {
  const prev = objects.get(id)
  objects.set(id, nextRecord)

  markDirty(id)
  markDirty("*")

  const prevParent = prev ? prev.parentID : undefined
  const nextParent = nextRecord.parentID
  if (prevParent !== nextParent) {
    if (prevParent !== undefined) {
      childrenCache.delete(prevParent)
      markDirty(`children:${prevParent}`)
    }
    if (nextParent !== undefined) {
      childrenCache.delete(nextParent)
      markDirty(`children:${nextParent}`)
    }
  } else if (!prev) {
    // brand new record whose parent already existed as a key - still needs its children list refreshed
    if (nextParent !== undefined) {
      childrenCache.delete(nextParent)
      markDirty(`children:${nextParent}`)
    }
  }

  // If this record's OWN childrenIDs changed (e.g. a directory just got a new child written to
  // it directly), its own children-list view needs refreshing too.
  const prevChildren = prev ? prev.childrenIDs : undefined
  const nextChildren = nextRecord.childrenIDs
  if (prevChildren !== nextChildren && !sameIdSet(prevChildren, nextChildren)) {
    childrenCache.delete(id)
    markDirty(`children:${id}`)
  }

  const prevType = prev ? prev.type : undefined
  const nextType = nextRecord.type
  if (prevType !== nextType) {
    invalidateTypeCachesFor(prevType)
    invalidateTypeCachesFor(nextType)
    if (prevType) markDirty(`type:${prevType}`)
    if (nextType) markDirty(`type:${nextType}`)
  }
}

function sameIdSet(a, b) {
  const ai = a || []
  const bi = b || []
  if (ai.length !== bi.length) return false
  const bSet = new Set(bi)
  return ai.every((id) => bSet.has(id))
}

function removeInternal(id) {
  const prev = objects.get(id)
  if (!prev) return
  objects.delete(id)
  childrenCache.delete(id)

  markDirty(id)
  markDirty("*")

  if (prev.parentID !== undefined) {
    childrenCache.delete(prev.parentID)
    markDirty(`children:${prev.parentID}`)
  }
  if (prev.type) {
    invalidateTypeCachesFor(prev.type)
    markDirty(`type:${prev.type}`)
  }
}

/** @returns {Object|undefined} the current record for `id` */
export function get(id) {
  return objects.get(id)
}

/** @returns {ReadonlyArray<String>} a stable (until changed) array of `parentID`'s childrenIDs */
export function getChildren(parentID) {
  if (!childrenCache.has(parentID)) {
    const parent = objects.get(parentID)
    childrenCache.set(parentID, Object.freeze((parent && parent.childrenIDs ? parent.childrenIDs : []).slice()))
  }
  return childrenCache.get(parentID)
}

/**
 * @param {String|Array<String>} types one or more MEDDataObject `type` values
 * @returns {ReadonlyArray<String>} a stable (until changed) array of ids matching any of `types`
 */
export function getIdsByType(types) {
  const list = Array.isArray(types) ? types : [types]
  const key = list.slice().sort().join(",")
  if (!typeListCache.has(key)) {
    const wanted = new Set(list)
    const result = []
    for (const [id, obj] of objects) {
      if (wanted.has(obj.type)) result.push(id)
    }
    typeListCache.set(key, Object.freeze(result))
    for (const type of list) {
      if (!typeListDependents.has(type)) typeListDependents.set(type, new Set())
      typeListDependents.get(type).add(key)
    }
  }
  return typeListCache.get(key)
}

/** @returns {Object} a plain `{ id -> record }` snapshot, stable (same reference) until something changes */
export function snapshot() {
  if (snapshotDirty || !cachedSnapshot) {
    cachedSnapshot = Object.fromEntries(objects)
    snapshotDirty = false
  }
  return cachedSnapshot
}

/** Inserts or fully replaces one record. */
export function upsert(record) {
  batch(() => setInternal(record.id, record))
}

/** Inserts or fully replaces several records in one notification batch. */
export function upsertMany(records) {
  batch(() => {
    for (const record of records) setInternal(record.id, record)
  })
}

/** Merges `fields` into the existing record for `id`. No-op if `id` isn't in the store. */
export function patch(id, fields) {
  const prev = objects.get(id)
  if (!prev) return
  batch(() => setInternal(id, { ...prev, ...fields }))
}

/**
 * @description Forces listeners of `id` (and "*"/snapshot consumers) to refresh, without changing
 * any tracked scalar field. Use this after mutating a nested/untracked property directly on the
 * object returned by get() - e.g. `medDataStore.get(id).metadata.foo = "bar"` - since patch()'s and
 * reconcile()'s equality checks only look at the tracked scalar fields and childrenIDs, and would
 * otherwise treat the (same-reference) record as unchanged and skip notifying. No-op if `id` isn't
 * in the store.
 */
export function touch(id) {
  const prev = objects.get(id)
  if (!prev) return
  batch(() => setInternal(id, { ...prev }))
}

/** Removes the record for `id`. No-op if it isn't in the store. */
export function remove(id) {
  batch(() => removeInternal(id))
}

/**
 * @description Diffs `dict` (a plain `{ id -> record }` object, e.g. from WorkspaceSync) against
 * the current store contents and applies only the actual differences: ids present in the store
 * but missing from `dict` are removed, ids whose fields differ are patched, unchanged ids are left
 * completely untouched (same reference, no notification). This is what turns "the whole workspace
 * was just reloaded" into "only the objects that actually changed re-render".
 */
export function reconcile(dict) {
  batch(() => {
    const nextIds = new Set(Object.keys(dict))
    for (const id of Array.from(objects.keys())) {
      if (!nextIds.has(id)) removeInternal(id)
    }
    for (const id of nextIds) {
      const nextRecord = dict[id]
      const prev = objects.get(id)
      if (!prev || !recordsEqual(prev, nextRecord)) {
        setInternal(id, nextRecord)
      }
    }
  })
}

function recordsEqual(a, b) {
  if (a === b) return true
  const scalarFields = ["id", "name", "type", "parentID", "inWorkspace", "path", "isLocked", "usedIn"]
  for (const field of scalarFields) {
    if (a[field] !== b[field]) return false
  }
  return sameIdSet(a.childrenIDs, b.childrenIDs)
}

/** Clears the whole store (e.g. on workspace close). */
export function reset() {
  batch(() => {
    for (const id of Array.from(objects.keys())) removeInternal(id)
  })
}

/**
 * @description Forces every "*" subscriber (see useGlobalDataCompat) to refresh, without changing
 * any stored record. Used by MEDDataObject.updateWorkspaceDataObject(): today's mutators still
 * mutate a record's fields in place rather than calling patch(), so the store has no way to know
 * exactly what changed - this is the coarse-grained "please re-render" fallback for that case.
 * Once those mutators call patch()/move()/remove() directly, this stops being needed for them.
 */
export function touchAll() {
  batch(() => markDirty("*"))
}

export const medDataStore = {
  subscribe,
  get,
  getChildren,
  getIdsByType,
  snapshot,
  upsert,
  upsertMany,
  patch,
  touch,
  remove,
  reconcile,
  reset,
  touchAll
}
