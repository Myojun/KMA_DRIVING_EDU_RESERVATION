let promise;
export function firebase() {
 if (!promise) promise = Promise.all([
  import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
 ]).then(([a, f]) => {
  const config = {
   apiKey:'AIzaSyAgZxM9bFkVzzLHTvDTY7HsoMVTDfQ-wIY',
   authDomain:'kma-driving-education-booking.firebaseapp.com',
   projectId:'kma-driving-education-booking',
   storageBucket:'kma-driving-education-booking.firebasestorage.app',
   messagingSenderId:'741013364677',appId:'1:741013364677:web:22f620279dc8e72fcbb5ac'
  };
  const app = a.getApps().length ? a.getApp() : a.initializeApp(config);
  return {f, db:f.getFirestore(app)};
 }).catch(error => { promise = undefined; throw error; });
 return promise;
}
export async function activeRecords(f, db, date) {
 const snapshot = await f.getDocsFromServer(f.query(f.collection(db,'reservations'),f.where('date','==',date),f.where('status','==','예약됨')));
 return snapshot.docs.map(doc => ({...doc.data(),id:doc.id}));
}

// Seed accounting only for dates not yet upgraded. Once initialized, normal operations
// read the date document, rather than downloading every reservation for that date.
export async function initialState(f, db, date) {
 const snapshot=await f.getDocFromServer(f.doc(db,'availableDates',date));
 if (!snapshot.exists() || snapshot.data().bookingState?.version === 2) return null;
 const {seedState}=await import('./core.js?v=20261029-slots');
 return seedState(await activeRecords(f,db,date),snapshot.data());
}
