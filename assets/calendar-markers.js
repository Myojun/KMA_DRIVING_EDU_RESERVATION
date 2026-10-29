import {todayKey,validDate,TIMES,COURSES,capacity} from './core.js?v=20261029-slots';
export function markerWindow(now=new Date()){
 const start=todayKey(now),last=new Date(start+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+13);return {start,end:last.toISOString().slice(0,10)};
}
export function hasOpenedEducation(schedule){return !!schedule&&schedule.isActive!==false&&TIMES.some(time=>COURSES.some(course=>capacity(schedule.timeSlots?.[time]?.[course])>0));}
export async function fetchOpenedDates(f,db,start,end){
 const query=f.query(f.collection(db,'availableDates'),f.where(f.documentId(),'>=',start),f.where(f.documentId(),'<=',end));
 const snapshot=await f.getDocsFromServer(query),days=new Set();
 for(const doc of snapshot.docs)if(validDate(doc.id)&&doc.id>=start&&doc.id<=end&&hasOpenedEducation(doc.data()))days.add(doc.id);
 return days;
}
