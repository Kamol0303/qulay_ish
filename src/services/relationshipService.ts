import { debugLogger } from '../lib/debugLogger';
import { db } from '../firebase';
import { query, collection, where, getDocs } from 'firebase/firestore';

export const relationshipService = {
  // Returns true if two users have an approved application or an active contract between them
  async canViewContact(userA: string, userB: string): Promise<boolean> {
    try {
      // Check for accepted application between them
      const appQ = query(collection(db, 'applications'), where('workerId', 'in', [userA, userB]));
      const appSnap = await getDocs(appQ);
      for (const d of appSnap.docs) {
        const data = d.data() as any;
        const participants = [data.workerId, data.employerId];
        if ((participants.includes(userA) && participants.includes(userB)) && data.status === 'accepted') return true;
      }

      // Check for active contract
      const contractQ = query(collection(db, 'contracts'), where('status', '==', 'active'));
      const contractSnap = await getDocs(contractQ);
      for (const d of contractSnap.docs) {
        const data = d.data() as any;
        if ((data.workerId === userA && data.employerId === userB) || (data.workerId === userB && data.employerId === userA)) return true;
      }

      return false;
    } catch (err) {
      debugLogger.error('relationshipService error', err);
      return false;
    }
  }
};
