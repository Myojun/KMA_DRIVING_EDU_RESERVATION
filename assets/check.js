import {$, node, status, displayDate, validDate, TIMES, COURSES, bindPhone, readIdentity, phoneVariants, normalizePhone, phoneHash, deadline, explain, userError, release, slotKey, canUserCancel} from './core.js?v=20261029-slots';
import {firebase, initialState} from './firebase.js?v=20261029-slots';
bindPhone();
let identity=null, busy=false, cancelling=false, pending=null, trigger=null, searchVersion=0;
const dialog=$('cancelDialog');
function closeDialog() { if (!cancelling) dialog.close(); }
$('keepReservation').addEventListener('click',closeDialog);
dialog.addEventListener('cancel',event => { if (cancelling) event.preventDefault(); });
dialog.addEventListener('close',() => { document.body.classList.remove('dialog-open'); trigger?.focus(); pending=null; });
function render(records) {
 const list=$('resultList'); list.replaceChildren();
 records.sort((a,b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || String(a.time ?? '').localeCompare(String(b.time ?? '')));
 $('resultCount').textContent=`${records.length}건`;
 for (const r of records) {
  const active=r.status==='예약됨'; const article=node('article',undefined,'booking-result'+(active ? '' : ' cancelled'));
  const top=node('div',undefined,'result-top'); top.append(node('h3',`${displayDate(r.date)} · ${r.time ?? '시간 확인 필요'} · ${r.courseType ?? '교육 확인 필요'}`),node('span',r.status || '상태 확인 필요','badge')); article.append(top);
  const details=node('dl');
  for (const [label,value] of [['예약자',r.name],['소속',`${r.grade ?? '-'}학년 ${r.unit ?? '-'}중대`],['연락처',r.phone]]) details.append(node('dt',label),node('dd',value));
  article.append(details);
  if (active && canUserCancel(r.date)) {
   const button=node('button','예약 취소'); button.type='button'; button.setAttribute('aria-label',`${displayDate(r.date)} ${r.time} ${r.courseType} 예약 취소`);
   button.addEventListener('click',() => { if (busy || cancelling) return; if(!canUserCancel(r.date)){status('searchStatus','지난 날짜의 예약은 취소할 수 없습니다.','error');return;} pending=r; trigger=button; $('cancelDescription').textContent=`${displayDate(r.date)} ${r.time} ${r.courseType} 교육 예약을 취소합니다.`; dialog.showModal(); document.body.classList.add('dialog-open'); });
   article.append(button);
  } else if(active){article.append(node('p','지난 예약 · 취소 불가','small'));}

  list.append(article);
 }
}
async function search(person) {
 if (busy || cancelling) return; busy=true; identity={...person}; const version=++searchVersion;
 $('searchBtn').disabled=true; $('resultList').replaceChildren(); $('resultCount').textContent=''; $('resultList').setAttribute('aria-busy','true'); status('searchStatus','예약 내역을 조회하고 있습니다.');
 try {
  const records=await deadline((async () => {
   const {f,db}=await firebase(); const results=await Promise.all(phoneVariants(person.phone).map(phone => f.getDocsFromServer(f.query(f.collection(db,'reservations'),f.where('name','==',person.name),f.where('phone','==',phone)))));
   const unique=new Map(); for (const result of results) result.forEach(doc => unique.set(doc.id,{...doc.data(),id:doc.id})); return [...unique.values()];
  })());
  if (version!==searchVersion) return;
  render(records); status('searchStatus',records.length ? `예약 ${records.length}건을 확인했습니다.` : '일치하는 예약이 없습니다. 입력 정보를 확인해 주세요.'); return true;
 } catch (error) { if (version===searchVersion) status('searchStatus',explain(error),'error'); return false; }
 finally { if (version===searchVersion) { busy=false; $('searchBtn').disabled=false; $('resultList').setAttribute('aria-busy','false'); } }
}
$('searchForm').addEventListener('submit',event => { event.preventDefault(); if (!$('searchForm').reportValidity()) return; const person=readIdentity(); if (person) search(person); });
$('clearResults').addEventListener('click',() => {
 if (cancelling) return; searchVersion++; busy=false; identity=null; $('searchForm').reset(); $('phone').setCustomValidity('');
 $('resultList').replaceChildren(); $('resultCount').textContent=''; $('searchBtn').disabled=false; $('resultList').setAttribute('aria-busy','false'); status('searchStatus','조회 내용을 지웠습니다.'); $('name').focus();
});
$('confirmCancel').addEventListener('click',async () => {
 if (!pending || !identity || cancelling) return;
 const r=pending, person={...identity}; cancelling=true; $('confirmCancel').disabled=true; $('keepReservation').disabled=true;
 $('confirmCancel').textContent='취소 처리 중';
 const slow=setTimeout(() => { $('cancelDescription').textContent='처리에 시간이 걸리고 있습니다. 완료 안내가 나올 때까지 기다려 주세요.'; },15000);
 let message='', kind='success';
 try {
  if (!navigator.onLine) throw userError('인터넷 연결을 확인해 주세요.');
  if(!canUserCancel(r.date))throw userError('지난 날짜의 예약은 취소할 수 없습니다.');
  if (!validDate(r.date) || !TIMES.includes(r.time) || !COURSES.includes(r.courseType)) throw userError('예약 정보가 올바르지 않습니다. 교관에게 문의해 주세요.');
  const {f,db}=await deadline(firebase()); const ref=f.doc(db,'reservations',r.id), dateRef=f.doc(db,'availableDates',r.date);
  const [seed,hash]=await deadline(Promise.all([initialState(f,db,r.date),phoneHash(person.phone)]));
  await f.runTransaction(db,async tx => {
   const reservation=await tx.get(ref);
   if (!reservation.exists()) throw userError('예약이 존재하지 않습니다. 다시 조회해 주세요.');
   const current=reservation.data();
   if(!canUserCancel(current.date))throw userError('지난 날짜의 예약은 취소할 수 없습니다.');
   if (current.name!==person.name || normalizePhone(current.phone)!==person.phone) throw userError('예약자 정보가 일치하지 않습니다.');
   // Read the persisted status: a second click or another tab never decrements twice.
   if (current.status==='취소됨') return;
   if (current.status!=='예약됨' || current.date!==r.date || current.time!==r.time || current.courseType!==r.courseType) throw userError('예약 정보가 변경되었습니다. 다시 조회해 주세요.');
   const date=await tx.get(dateRef);
   if (date.exists()) {
    const data=date.data(); const state=release(data,seed,hash,r.id,current.time,current.courseType);
    const patch={bookingState:state};
    if (data.timeSlots?.[current.time]?.[current.courseType]) patch[`timeSlots.${current.time}.${current.courseType}.currentCount`]=state.counts[slotKey(current.time,current.courseType)];
    tx.update(dateRef,patch);
   }
   tx.update(ref,{status:'취소됨',canceledAt:f.serverTimestamp(),updatedAt:f.serverTimestamp(),canceledBy:'user'});
  });
  message='예약을 취소했습니다.';
 } catch (error) { message=explain(error)+' 예약조회에서 현재 상태를 확인해 주세요.'; kind='error'; }
 finally {
  clearTimeout(slow); cancelling=false; $('confirmCancel').disabled=false; $('keepReservation').disabled=false; $('confirmCancel').textContent='예약 취소'; dialog.close();
 }
 const refreshed=await search(person);
 status('searchStatus',message + (refreshed ? '' : ' 내역을 새로 불러오지 못했습니다. 다시 조회해 주세요.'),kind);
});
window.addEventListener('pagehide',() => { searchVersion++; identity=null; $('resultList').replaceChildren(); $('searchForm').reset(); });
window.addEventListener('pageshow',event => { if (event.persisted) { busy=false; $('searchBtn').disabled=false; $('resultCount').textContent=''; status('searchStatus','이름과 전화번호를 다시 입력해 주세요.'); } });
