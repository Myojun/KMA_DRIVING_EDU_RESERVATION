import {sha256Hex} from './sha256.js?v=20261029-slots';
// Pure helpers, shared by pages and offline verification. No personal data is stored in the browser.
export const TIMES = ['08시', '10시', '13시', '15시', '17시'];
export const COURSES = ['기능', '도로기초', '도봉'];
export const $ = id => document.getElementById(id);
export function node(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = String(text ?? ''); if (className) e.className = className; return e; }
export function status(id, message, kind = '') { const e = $(id); e.textContent = message; e.className = 'status' + (kind ? ' ' + kind : ''); }
export function todayKey(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function validDate(key) { if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false; const d = new Date(key + 'T12:00:00Z'); return Number.isFinite(+d) && d.toISOString().slice(0,10) === key; }
export function displayDate(key) { return validDate(key) ? key.replace(/-/g, '.') : '날짜 확인 필요'; }
export function slotKey(time, course) { if (!TIMES.includes(time) || !COURSES.includes(course)) throw new Error('교육 구분을 확인해 주세요.'); return `${time}|${course}`; }
export function capacity(slot) { return slot?.isAvailable === true && Number.isInteger(slot.maxCapacity) && slot.maxCapacity > 0 ? slot.maxCapacity : 0; }
export function normalizePhone(value) { const digits = String(value).replace(/\D/g, ''); return /^01[016789]\d{7,8}$/.test(digits) ? (digits.length === 11 ? digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')) : null; }
export function phoneVariants(phone) { return [...new Set([phone, phone.replace(/-/g, '')])]; }
export function bindPhone() { $('name').addEventListener('input', () => $('name').setCustomValidity('')); const input = $('phone'); input.addEventListener('input', () => input.setCustomValidity('')); input.addEventListener('blur', () => { const phone = normalizePhone(input.value); if (phone) input.value = phone; }); }
export function readIdentity() { const name = $('name').value.trim(); const phone = normalizePhone($('phone').value); if (!name) { $('name').setCustomValidity('이름을 입력해 주세요.'); $('name').reportValidity(); return null; } $('name').setCustomValidity(''); if (!phone) { $('phone').setCustomValidity('휴대전화 번호를 확인해 주세요.'); $('phone').reportValidity(); return null; } $('phone').value = phone; return {name, phone}; }
export async function deadline(promise, ms = 15000) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('READ_TIMEOUT')), ms); })]); } finally { clearTimeout(timer); } }
export function explain(error) {
 const code=String(error?.code||'').replace(/^firestore\//,'');
 if(code==='permission-denied')return '접근 권한을 확인할 수 없습니다. 관리자에게 문의해 주세요.';
 if(code==='unauthenticated')return '관리자 인증 상태를 확인해 주세요.';
 if(code==='failed-precondition')return '데이터베이스 설정을 확인해야 합니다. 관리자에게 문의해 주세요.';
 if(error?.message==='READ_TIMEOUT'||code==='deadline-exceeded')return '응답이 지연되고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
 if(code==='unavailable'||navigator.onLine===false)return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
 if(error?.message?.startsWith('USER:'))return error.message.slice(5);
 if(/dynamically imported module|module script|importing a module/i.test(error?.message||''))return 'Firebase 파일을 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.';
 const label=/^[a-z0-9_/-]{1,60}$/i.test(code)?code:['TypeError','ReferenceError','NotSupportedError','SecurityError'].includes(error?.name)?error.name:'';
 return '요청을 처리하지 못했습니다. 새로고침 후 다시 시도해 주세요.'+(label?' ('+label+')':'');
}
export const userError = text => new Error('USER:' + text);
export async function phoneHash(phone) { return sha256Hex(phone.replace(/-/g, '')); }
export function dateOfTimestamp(value) { try { const d = typeof value?.toDate === 'function' ? value.toDate() : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null; return d && Number.isFinite(+d) ? d : null; } catch { return null; } }
// Version 2 scopes duplicate reservations to a phone + time within each date.
// Existing version-1 accounting is rebuilt only during an explicit mutation.
export const hasScheduleCounts = schedule => [1,2].includes(schedule?.bookingState?.version);
export function legacyStateToken(schedule){
 const s=schedule?.bookingState;if(!s)return 'none';
 return JSON.stringify([s.version,Object.entries(s.counts||{}).sort(([a],[b])=>a.localeCompare(b)),Object.entries(s.phones||{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,ids])=>[key,Array.isArray(ids)?[...ids].sort():ids])]);
}
export async function seedState(records,sourceSchedule){
 const counts={},phones={},phoneTimes={};
 for(const record of records){
  if(record.status!=='예약됨'||!TIMES.includes(record.time)||!COURSES.includes(record.courseType))continue;
  const key=slotKey(record.time,record.courseType);counts[key]=(counts[key]||0)+1;
  const phone=normalizePhone(record.phone);if(phone){const hash=await phoneHash(phone);(phones[hash]||=[]).push(record.id);const times=phoneTimes[hash]||={};(times[record.time]||=[]).push(record.id);}
 }
 const state={version:2,counts,phones,phoneTimes};
 if(arguments.length>1)Object.defineProperty(state,'_legacyBase',{value:legacyStateToken(sourceSchedule)});
 return state;
}
export function cloneState(schedule,seed){
 const existing=schedule.bookingState;
 if(existing&&![1,2].includes(existing.version))throw userError('예약 집계 버전이 변경되었습니다. 페이지를 새로고침해 주세요.');
 if(existing?.version===1&&seed?._legacyBase!==legacyStateToken(schedule))throw userError('예약 현황이 변경되었습니다. 다시 조회한 뒤 시도해 주세요.');
 const s=existing?.version===2?existing:seed;
 if(!s||s.version!==2||!s.counts||!s.phones||!s.phoneTimes)throw userError('예약 집계 정보를 다시 불러와 주세요.');
 const copy=JSON.parse(JSON.stringify(s));
 for(const value of Object.values(copy.counts))if(!Number.isInteger(value)||value<0)throw userError('예약 집계 정보를 확인해 주세요.');
 for(const ids of Object.values(copy.phones))if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw userError('예약 집계 정보를 확인해 주세요.');
 for(const times of Object.values(copy.phoneTimes)){
  if(!times||typeof times!=='object'||Array.isArray(times))throw userError('시간대별 예약 집계를 확인해 주세요.');
  for(const [time,ids] of Object.entries(times))if(!TIMES.includes(time)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw userError('시간대별 예약 집계를 확인해 주세요.');
 }
 return copy;
}
export function allocate(schedule,seed,hash,id,time,course){
 const state=cloneState(schedule,seed),key=slotKey(time,course),max=capacity(schedule.timeSlots?.[time]?.[course]);
 if(!max)throw userError('선택한 교육이 개설되지 않았습니다.');
 if(state.phoneTimes[hash]?.[time]?.length)throw userError('같은 시간대에 이미 예약이 있습니다. 다른 시간대를 선택해 주세요.');
 const count=state.counts[key]||0;if(count>=max)throw userError('선택한 교육은 정원이 마감되었습니다.');
 state.counts[key]=count+1;state.phones[hash]=[...new Set([...(state.phones[hash]||[]),id])];const times=state.phoneTimes[hash]||={};times[time]=[id];return state;
}
export function release(schedule,seed,hash,id,time,course){
 const state=cloneState(schedule,seed),key=slotKey(time,course);
 state.counts[key]=Math.max(0,(state.counts[key]||0)-1);
 state.phones[hash]=(state.phones[hash]||[]).filter(value=>value!==id);if(!state.phones[hash].length)delete state.phones[hash];
 const times=state.phoneTimes[hash];if(times){times[time]=(times[time]||[]).filter(value=>value!==id);if(!times[time].length)delete times[time];if(!Object.keys(times).length)delete state.phoneTimes[hash];}
 return state;
}
export function canUserCancel(date,now=new Date()){return validDate(date)&&date>=todayKey(now);}
