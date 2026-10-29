'use strict';
const menuButton = document.querySelector('.menu-button');
const siteNav = document.getElementById('siteNav');
const mobile = matchMedia('(max-width:700px)');
function resetMenu() { menuButton.hidden = !mobile.matches; siteNav.hidden = mobile.matches; menuButton.setAttribute('aria-expanded', 'false'); }
resetMenu(); mobile.addEventListener('change', resetMenu);
menuButton.addEventListener('click', () => { siteNav.hidden = !siteNav.hidden; menuButton.setAttribute('aria-expanded', String(!siteNav.hidden)); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && mobile.matches && !siteNav.hidden) { siteNav.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.focus(); } });
// A broken optional illustration does not remove its surrounding instructions.
document.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { image.alt = image.alt || '학교 마크'; image.classList.add('image-failed'); }));

if (location.protocol === 'file:') {
 const warning=document.createElement('p'); warning.className='callout'; warning.setAttribute('role','alert');
 warning.textContent='이 사이트의 공지·예약 기능은 웹 서버에서 실행해야 합니다. 압축파일의 적용안내에 따라 로컬 미리보기 서버를 실행하거나 기존 HTTPS 사이트에 업로드해 주세요.';
 document.getElementById('main').prepend(warning);
}

// The HTTP compatibility path is functional; recommend transport security without
// forcing an unverified HTTPS endpoint or changing browser security settings.
if(location.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
 const notice=document.createElement('p');notice.className='connection-notice';notice.setAttribute('role','status');
 notice.append(document.createTextNode('HTTP 접속 중 · '));const secure=document.createElement('a');const url=new URL(location.href);url.protocol='https:';secure.href=url.href;secure.textContent='HTTPS로 접속';notice.append(secure);document.getElementById('main')?.prepend(notice);
}
