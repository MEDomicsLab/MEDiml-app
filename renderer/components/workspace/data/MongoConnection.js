/* eslint-disable no-unused-vars */
const { MongoClient } = require("mongodb")

const uri = "mongodb://localhost:54017"
const dbName = "data"

let client = null
let indexPromise = null

/**
 * @description Returns the MongoDB "data" database for the current workspace, lazily connecting
 * and ensuring the indexes in ENSURE_INDEXES exist. Safe to call concurrently: every caller
 * awaits the same connect/index-creation promise instead of racing to connect.
 * @returns {Promise<import("mongodb").Db>}
 */
export async function getDb() {
  if (!client) {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize: 20 })
    await client.connect()
  }
  const db = client.db(dbName)
  if (!indexPromise) {
    indexPromise = ensureIndexes(db).catch((err) => {
      console.error("Failed to ensure MongoDB indexes:", err)
      // Allow the next getDb() call to retry index creation instead of caching the failure forever.
      indexPromise = null
      return null
    })
  }
  await indexPromise
  return db
}

/**
 * @description Closes the current MongoDB connection (if any) and forgets the cached index
 * state, so the next getDb() call reconnects and re-verifies indexes from scratch. Must be
 * called whenever the workspace changes: the embedded mongod is stopped and restarted against a
 * different dbPath on the same port, and without this the cached client would silently keep
 * talking to the old topology for a while.
 */
export async function resetConnection() {
  indexPromise = null
  const closingClient = client
  client = null
  if (closingClient) {
    try {
      await closingClient.close()
    } catch (err) {
      console.warn("Error while closing the previous MongoDB connection:", err)
    }
  }
}

/**
 * @description Index specifications applied on every connect. Each entry mirrors a query pattern
 * that is otherwise an unindexed full collection scan:
 *   - id_unique          -> every findOne/updateOne({id}) across mongoDBUtils.js
 *   - parent_type_name   -> the "does this name/type already exist under this parent" check, and
 *                           any future listChildren(parentID) query
 *   - path_sparse        -> findMEDDataObjectByPath (path is not set on every document, hence sparse)
 *   - name_type          -> findMEDDataObjectByName / findMEDDataObjectsByName
 * inWorkspace/isLocked (2-value fields) and childrenIDs (multikey, written on every child add/
 * remove for no query benefit) are deliberately left unindexed.
 */
const MED_DATA_OBJECT_INDEXES = [
  { keys: { id: 1 }, options: { unique: true, name: "id_unique" } },
  { keys: { parentID: 1, type: 1, name: 1 }, options: { name: "parent_type_name" } },
  { keys: { path: 1 }, options: { sparse: true, name: "path_sparse" } },
  { keys: { name: 1, type: 1 }, options: { name: "name_type" } }
]

async function ensureIndexes(db) {
  for (const { keys, options } of MED_DATA_OBJECT_INDEXES) {
    await ensureOneIndex(db, "medDataObjects", keys, options)
  }

  // The tag collections' names are user/session-configurable (see mongoDBUtils.getCollectionTags),
  // defaulting to "column_tags" when nothing has been set yet.
  const tagsCollectionName = (typeof localStorage !== "undefined" && localStorage.getItem("tagsUUID")) || "column_tags"
  await ensureOneIndex(db, tagsCollectionName, { collection_id: 1 }, { name: "collection_id" })
  await ensureOneIndex(db, "row_tags", { collectionName: 1 }, { name: "collectionName" })
}

async function ensureOneIndex(db, collectionName, keys, options) {
  try {
    await db.collection(collectionName).createIndex(keys, options)
  } catch (err) {
    if (options.unique && (err.code === 11000 || err.codeName === "DuplicateKey")) {
      console.warn(`Duplicate values found while creating unique index ${collectionName}.${JSON.stringify(keys)} - deduplicating and retrying...`)
      await dedupeById(db, collectionName)
      try {
        await db.collection(collectionName).createIndex(keys, options)
        return
      } catch (retryErr) {
        console.warn(`Unique index ${collectionName}.${JSON.stringify(keys)} still conflicts after dedupe, falling back to a non-unique index:`, retryErr)
        try {
          await db.collection(collectionName).createIndex(keys, { ...options, unique: false })
        } catch (fallbackErr) {
          console.error(`Failed to create fallback index ${collectionName}.${JSON.stringify(keys)}:`, fallbackErr)
        }
        return
      }
    }
    // Index creation must never block workspace open - log and move on.
    console.error(`Failed to create index ${collectionName}.${JSON.stringify(keys)}:`, err)
  }
}

/**
 * @description One-time repair for legacy workspaces that may contain documents with duplicate
 * `id` values (possible under the old, non-atomic insert-then-check path). For each duplicate
 * group, keeps the most complete document - preferring one with a non-null `path`, then the one
 * with the most `childrenIDs` - and deletes the rest, so a unique index on `id` can be created.
 */
async function dedupeById(db, collectionName) {
  const collection = db.collection(collectionName)
  const duplicateGroups = await collection
    .aggregate([
      { $group: { _id: "$id", count: { $sum: 1 }, docs: { $push: "$$ROOT" } } },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray()

  for (const group of duplicateGroups) {
    const ranked = group.docs.slice().sort((a, b) => {
      const aHasPath = a.path ? 1 : 0
      const bHasPath = b.path ? 1 : 0
      if (aHasPath !== bHasPath) return bHasPath - aHasPath
      return (b.childrenIDs?.length || 0) - (a.childrenIDs?.length || 0)
    })
    const [, ...toDrop] = ranked
    for (const doc of toDrop) {
      await collection.deleteOne({ _id: doc._id })
    }
    console.warn(`Deduplicated MEDDataObject id=${group._id}: removed ${toDrop.length} duplicate document(s)`)
  }
}
