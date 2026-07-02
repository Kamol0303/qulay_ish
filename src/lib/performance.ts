import { debugLogger } from './debugLogger';
import { 
  query, 
  collection, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  QueryConstraint,
  Query,
  DocumentData,
  onSnapshot,
  getCountFromServer,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Performance & Scale Utilities for QULAY ISH
 * 
 * Strategy for 100K+ users:
 * 1. Denormalization: Store essential info (name, photo) on related docs to avoid joins.
 * 2. Pagination: Never fetch all docs; always use limit() and startAfter().
 * 3. Indexing: Ensure all compound queries have corresponding Firestore indexes.
 * 4. Caching: Use local state and potentially IndexedDB for offline-first and speed.
 */

export const performanceUtils = {
  /**
   * Optimized query builder with mandatory limits for scale.
   */
  createPaginatedQuery(
    collectionName: string, 
    constraints: QueryConstraint[], 
    pageSize: number = 20,
    lastDoc?: QueryDocumentSnapshot<DocumentData>
  ): Query<DocumentData> {
    const baseConstraints = [...constraints, limit(pageSize)];
    if (lastDoc) {
      baseConstraints.push(startAfter(lastDoc));
    }
    return query(
      collection(db, collectionName),
      ...baseConstraints
    );
  },

  /**
   * Efficiently get the total count of documents in a collection or query.
   * Uses Firestore's getCountFromServer which is much cheaper and faster than fetching all docs.
   */
  async getCollectionCount(q: Query<DocumentData>): Promise<number> {
    try {
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      debugLogger.error('Error getting collection count:', error);
      return 0;
    }
  },

  /**
   * Real-time listener with error handling and cleanup.
   */
  listenToCollection(
    q: Query<DocumentData>,
    onData: (data: any[]) => void,
    onError?: (error: any) => void
  ) {
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      onData(data);
    }, (error) => {
      debugLogger.error('Firestore subscription error:', error);
      if (onError) onError(error);
    });
  }
};
