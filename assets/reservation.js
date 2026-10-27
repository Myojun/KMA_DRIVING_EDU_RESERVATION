import {$, TIMES, COURSES, node, status, todayKey, displayDate, slotKey, capacity, bindPhone, readIdentity, deadline, explain, allocate, userError, phoneHash} from './core.js?v=20261027-final';
import {firebase, initialState} from './firebase.js?v=20261027-final';
bindPhone();
let selectedDate = todayKey(), month = selectedDate.slice(0,7), selectedSlot = null;
let scheduleError=false;
let schedule = null, counts = {}, ready = false, submitting = false, generation = 0;
let stopDate = null, stopLegacy = null, timer = null;
function cleanup() { stopDate?.(); stopLegacy?.(); stopDate = stopLegacy = null; clearTimeout(timer); }
function drawCalendar() {
 const restoreFocus = document.activeElement?.closest?.('#calendar') != null;
 const [year, m] = month.split('-').map(Number); const cal = $('calendar'); cal.replaceChildren();
 $('currentMonth').textContent = `${year}년 ${m}월`;
 for (const label of ['일','월','화','수','목','금','토']) cal.append(node('span',label,'weekday'));
 const first = new Date(Date.UTC(year,m-1,1)).getUTCDay(); const last = new Date(Date.UTC(year,m,0)).getUTCDate();
 for (let i=0;i<first;i++) cal.append(node('span',''));
 for (let d=1;d<=last;d++) {
  const key = `${month}-${String(d).padStart(2,'0')}`; const button = node('button',d); button.type='button';
  button.disabled = key < todayKey() || submitting;
  button.setAttribute('aria-label',`${year}년 ${m}월 ${d}일`);
  button.setAttribute('aria-pressed',String(selectedDate === key));
  if (key === todayKey()) { button.classList.add('today'); button.setAttribute('aria-current','date'); }
  button.dataset.date=key; button.addEventListener('click',() => selectDate(key)); cal.append(button);
 }
 if (restoreFocus) cal.querySelector(`[data-date="${selectedDate}"]`)?.focus();
}
function selectionText() { $('selectionSummary').textContent = selectedSlot ? `${displayDate(selectedDate)} · ${selectedSlot.time} · ${selectedSlot.course}` : '일정표에서 교육을 선택해 주세요.'; $('submitBtn').disabled = !ready || !selectedSlot || submitting; }
function drawSchedule() {
 const focused = document.activeElement; const focusTime=focused?.dataset?.time; const focusCourse=focused?.dataset?.course;
 if (selectedSlot) { const max=capacity(schedule?.timeSlots?.[selectedSlot.time]?.[selectedSlot.course]); if (!ready || !max || (counts[slotKey(selectedSlot.time,selectedSlot.course)] || 0) >= max) selectedSlot=null; }
 const body = $('scheduleBody'); body.replaceChildren();
 for (const time of TIMES) {
  const row = node('tr'); const th = node('th',time); th.scope='row'; row.append(th);
  for (const course of COURSES) {
   const td = node('td'); const button = node('button'); button.type='button'; button.className='slot'; button.dataset.time=time; button.dataset.course=course;
   const max = capacity(schedule?.timeSlots?.[time]?.[course]); const count = counts[slotKey(time,course)] || 0;
   const open = ready && max > count && selectedDate >= todayKey();
   if (!ready) button.append(node('span',scheduleError ? '확인 불가' : '확인 중'));
   else if (!max) button.append(node('span','미개설'));
   else { button.append(node('span',`${count} / ${max}`),node('small',count >= max ? '마감' : '예약 가능')); }
   button.disabled = !open || submitting;
   button.setAttribute('aria-label',`${time} ${course}, ${!ready ? (scheduleError ? '확인 불가' : '확인 중') : !max ? '미개설' : `${count}명 예약, 정원 ${max}명, ${open ? '선택 가능' : '마감'}`}`);
   button.setAttribute('aria-pressed',String(selectedSlot?.time === time && selectedSlot?.course === course));
   button.addEventListener('click',() => { if (!ready || submitting) return; selectedSlot={time,course}; drawSchedule(); selectionText(); status('formStatus',`${time} ${course} 교육을 선택했습니다. 예약자 정보를 입력해 주세요.`); });
   td.append(button); row.append(td);
  }
  body.append(row);
 }
 selectionText();
 if (focusTime && focusCourse) body.querySelector(`[data-time="${focusTime}"][data-course="${focusCourse}"]:not(:disabled)`)?.focus();
}
function failed(error, token) {
 if (token!==generation) return; cleanup(); ready=false; scheduleError=true; schedule=null; selectedSlot=null;
 $('scheduleBody').setAttribute('aria-busy','false'); drawSchedule(); status('scheduleStatus',explain(error) + ' 새로고침을 눌러 주세요.','error');
}
async function selectDate(key) {
 if (submitting) return;
 selectedDate=key; scheduleError=false; selectedSlot=null; ready=false; schedule=null; counts={}; const token=++generation; cleanup();
 drawCalendar(); drawSchedule(); $('selectedDateDisplay').textContent=displayDate(key)+' 교육일정';
 $('scheduleBody').setAttribute('aria-busy','true'); status('scheduleStatus','일정을 불러오는 중입니다.'); status('formStatus','');
 try {
  const {f,db}=await deadline(firebase()); if (token!==generation) return;
  timer=setTimeout(() => failed(new Error('READ_TIMEOUT'),token),15000);
  const done=() => { clearTimeout(timer); ready=true; $('scheduleBody').setAttribute('aria-busy','false'); drawSchedule(); status('scheduleStatus',schedule ? '일정 확인 완료' : '이 날짜에는 개설된 교육이 없습니다.'); };
  stopDate=f.onSnapshot(f.doc(db,'availableDates',key),{includeMetadataChanges:true},snapshot => {
   if (token!==generation) return;
   if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) { ready=false; selectedSlot=null; drawSchedule(); status('scheduleStatus','서버의 최신 일정을 확인하는 중입니다.'); clearTimeout(timer); timer=setTimeout(() => failed(new Error('READ_TIMEOUT'),token),15000); return; }
   schedule=snapshot.exists() ? snapshot.data() : null;
   if (!schedule || schedule.bookingState?.version === 1) {
    stopLegacy?.(); stopLegacy=null; counts=schedule?.bookingState?.counts || {}; done();
   } else if (!stopLegacy) {
    ready=false; drawSchedule();
    const q=f.query(f.collection(db,'reservations'),f.where('date','==',key),f.where('status','==','예약됨'));
    stopLegacy=f.onSnapshot(q,{includeMetadataChanges:true},records => {
     if (token!==generation || schedule?.bookingState?.version === 1) return;
     if (records.metadata.fromCache || records.metadata.hasPendingWrites) { ready=false; drawSchedule(); return; }
     counts={}; records.forEach(doc => { const r=doc.data(); if (TIMES.includes(r.time) && COURSES.includes(r.courseType)) { const k=slotKey(r.time,r.courseType); counts[k]=(counts[k] || 0)+1; } }); done();
    },error => failed(error,token));
   } else { drawSchedule(); }
  },error => failed(error,token));
 } catch (error) { failed(error,token); }
}
$('scheduleRetry').addEventListener('click',() => selectDate(selectedDate));
for (const [id,delta] of [['prevMonth',-1],['nextMonth',1]]) $(id).addEventListener('click',() => {
 if (submitting) return; const [y,m]=month.split('-').map(Number); const d=new Date(Date.UTC(y,m-1+delta,1));
 if (d.getUTCFullYear()<2000 || d.getUTCFullYear()>2100) return;
 month=d.toISOString().slice(0,7); drawCalendar();
});
$('reservationForm').addEventListener('submit',async event => {
 event.preventDefault(); if (submitting || !$('reservationForm').reportValidity()) return;
 const identity=readIdentity(); if (!identity) return;
 if (!ready || !selectedSlot || selectedDate < todayKey()) { status('formStatus','날짜와 예약 가능한 교육을 다시 선택해 주세요.','error'); return; }
 const grade=Number($('grade').value), unit=Number($('unit').value);
 if (!Number.isInteger(grade) || grade<1 || grade>4 || !Number.isInteger(unit) || unit<1 || unit>8) return;
 const request={date:selectedDate,time:selectedSlot.time,courseType:selectedSlot.course,...identity,grade,unit,note:$('note').value.trim()};
 submitting=true; $('reservationForm').querySelectorAll('input,select,textarea').forEach(field => field.disabled=true); $('submitBtn').disabled=true; $('submitBtn').textContent='예약 처리 중'; drawCalendar(); drawSchedule();
 $('reservationForm').setAttribute('aria-busy','true'); status('formStatus','예약을 처리하고 있습니다. 완료 안내가 나올 때까지 기다려 주세요.');
 const slow=setTimeout(() => status('formStatus','예약 확인에 시간이 걸리고 있습니다. 중복 신청하지 말고 결과를 기다려 주세요.'),15000);
 try {
  if (!navigator.onLine) throw userError('인터넷 연결을 확인해 주세요.');
  const {f,db}=await deadline(firebase()); const dateRef=f.doc(db,'availableDates',request.date);
  const [seed,hash]=await deadline(Promise.all([initialState(f,db,request.date),phoneHash(request.phone)])); const reservationRef=f.doc(f.collection(db,'reservations'));
  // The callback has only transaction reads/writes; counters and daily duplicate locks
  // live in the same date document. Firestore reruns it after concurrent modifications.
  await f.runTransaction(db,async tx => {
   const snapshot=await tx.get(dateRef);
   if (!snapshot.exists() || request.date < todayKey()) throw userError('선택한 날짜는 예약할 수 없습니다.');
   const data=snapshot.data(); const state=allocate(data,seed,hash,reservationRef.id,request.time,request.courseType);
   tx.set(reservationRef,{...request,status:'예약됨',createdAt:f.serverTimestamp(),updatedAt:f.serverTimestamp()});
   tx.update(dateRef,{bookingState:state,[`timeSlots.${request.time}.${request.courseType}.currentCount`]:state.counts[slotKey(request.time,request.courseType)]});
  });
  $('reservationForm').reset(); selectedSlot=null;
  status('formStatus',`${displayDate(request.date)} ${request.time} ${request.courseType} 예약이 완료되었습니다. 예약조회에서 확인할 수 있습니다.`,'success');
 } catch (error) {
  status('formStatus',explain(error) + ' 연결 오류가 발생했다면 예약조회에서 접수 여부를 확인한 뒤 다시 신청해 주세요.','error');
 } finally {
  clearTimeout(slow); submitting=false; $('reservationForm').querySelectorAll('input,select,textarea').forEach(field => field.disabled=false); $('reservationForm').setAttribute('aria-busy','false'); $('submitBtn').textContent='예약하기'; drawCalendar(); drawSchedule();
 }
});
window.addEventListener('pagehide',() => { generation++; cleanup(); ready=false; });
window.addEventListener('pageshow',event => { if (event.persisted) selectDate(todayKey()); });
document.addEventListener('visibilitychange',() => { if (!document.hidden && !submitting) { if (selectedDate < todayKey()) { month=todayKey().slice(0,7); selectDate(todayKey()); } } });
selectDate(selectedDate);

window.addEventListener('online',() => { if (!document.hidden && !submitting) selectDate(selectedDate < todayKey() ? todayKey() : selectedDate); });
