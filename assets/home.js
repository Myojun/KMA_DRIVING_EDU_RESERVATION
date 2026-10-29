import {$, status, dateOfTimestamp, deadline, explain} from './core.js?v=20261029-slots';
import {firebase} from './firebase.js?v=20261029-slots';
let busy = false, loaded = false, lastAttempt = 0;
async function load() {
 if (busy || Date.now() - lastAttempt < 2000) return;
 busy = true; lastAttempt = Date.now(); $('noticeRetry').disabled = true; $('noticeRegion').setAttribute('aria-busy','true'); status('noticeStatus','공지사항을 불러오는 중입니다.');
 try {
  const snapshot = await deadline((async () => { const {f, db} = await firebase(); return f.getDocFromServer(f.doc(db,'announcements','main')); })());
  const data = snapshot.exists() ? snapshot.data() : {};
  $('noticeContent').textContent = !snapshot.exists() ? '등록된 공지사항이 없습니다.' : typeof data.content === 'string' && data.content.trim() ? data.content : '공지 내용이 없습니다.';
  const date = dateOfTimestamp(data.createdAt); $('noticeDate').hidden = !date;
  if (date) { $('noticeDate').dateTime = date.toISOString(); $('noticeDate').textContent = '작성일 ' + new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
  loaded = true; status('noticeStatus','공지사항을 확인했습니다.');
 } catch (error) { if (!loaded) $('noticeContent').textContent = '공지사항을 확인할 수 없습니다.'; status('noticeStatus',explain(error) + (loaded ? ' 이전 내용을 표시합니다.' : ''),'error'); }
 finally { busy = false; $('noticeRetry').disabled = false; $('noticeRegion').setAttribute('aria-busy','false'); }
}
$('noticeRetry').addEventListener('click',load);
setInterval(() => { if (!document.hidden) load(); },300000);
document.addEventListener('visibilitychange',() => { if (!document.hidden && Date.now()-lastAttempt >=300000) load(); });
window.addEventListener('online',() => { if (!document.hidden) load(); });
load();
