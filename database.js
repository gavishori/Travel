import { db, FB } from './firebase.js';

export const dbService = {
  async getUserTrips(uid) {
    const q = FB.query(
      FB.collection(db, 'trips'),
      FB.where('uid', '==', uid),
      FB.orderBy('createdAt', 'desc')
    );
    const snap = await FB.getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getTrip(id) {
    const ref = FB.doc(db, 'trips', id);
    const snap = await FB.getDoc(ref);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async saveTrip(id, data) {
    const ref = FB.doc(db, 'trips', id);
    await FB.setDoc(ref, data, { merge: true });
    return true;
  },

  async updateTrip(id, patch) {
    const ref = FB.doc(db, 'trips', id);
    await FB.updateDoc(ref, patch);
    return true;
  },

  async deleteTrip(id) {
    const ref = FB.doc(db, 'trips', id);
    await FB.deleteDoc(ref);
    return true;
  }
};
