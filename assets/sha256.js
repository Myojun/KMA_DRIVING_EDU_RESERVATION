// SHA-256 compatibility path. The digest is identical to Web Crypto, so persisted
// phone hashes and transaction keys never change between HTTP/HTTPS or browsers.
const K=new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
export function utf8Bytes(value){
 const text=String(value);if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text);
 const bytes=[];for(let i=0;i<text.length;i++){
  let c=text.charCodeAt(i);
  if(c>=0xd800&&c<=0xdbff){const low=text.charCodeAt(i+1);if(low>=0xdc00&&low<=0xdfff){c=0x10000+((c-0xd800)<<10)+low-0xdc00;i++;}else c=0xfffd;}
  else if(c>=0xdc00&&c<=0xdfff)c=0xfffd;
  if(c<0x80)bytes.push(c);else if(c<0x800)bytes.push(0xc0|(c>>6),0x80|(c&63));else if(c<0x10000)bytes.push(0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));else bytes.push(0xf0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
 }return new Uint8Array(bytes);
}
const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
export function sha256Fallback(bytes){
 const length=bytes.length,padded=new Uint8Array(Math.ceil((length+9)/64)*64);padded.set(bytes);padded[length]=0x80;
 const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(length/0x20000000),false);view.setUint32(padded.length-4,(length*8)>>>0,false);
 const state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
 for(let offset=0;offset<padded.length;offset+=64){
  for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4,false);
  for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0;}
  let [a,b,c,d,e,f,g,h]=state;
  for(let i=0;i<64;i++){const first=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;const second=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;}
  const words=[a,b,c,d,e,f,g,h];for(let i=0;i<8;i++)state[i]=(state[i]+words[i])>>>0;
 }
 const result=new Uint8Array(32),out=new DataView(result.buffer);for(let i=0;i<8;i++)out.setUint32(i*4,state[i],false);return result;
}
export async function sha256Hex(value,provider=globalThis.crypto){
 const bytes=utf8Bytes(value);let digest;
 if(provider?.subtle?.digest){try{digest=new Uint8Array(await provider.subtle.digest('SHA-256',bytes));}catch{/* Restricted WebViews use the equivalent local implementation. */}}
 if(!digest||digest.length!==32)digest=sha256Fallback(bytes);
 return Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
}
