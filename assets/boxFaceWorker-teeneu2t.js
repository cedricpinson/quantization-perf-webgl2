var C=1e-6,V=typeof Float32Array<"u"?Float32Array:Array,k=Math.random;Math.hypot||(Math.hypot=function(){for(var n=0,r=arguments.length;r--;)n+=arguments[r]*arguments[r];return Math.sqrt(n)});function on(){var n=new V(9);return V!=Float32Array&&(n[1]=0,n[2]=0,n[3]=0,n[5]=0,n[6]=0,n[7]=0),n[0]=1,n[4]=1,n[8]=1,n}function vn(){var n=new V(16);return V!=Float32Array&&(n[1]=0,n[2]=0,n[3]=0,n[4]=0,n[6]=0,n[7]=0,n[8]=0,n[9]=0,n[11]=0,n[12]=0,n[13]=0,n[14]=0),n[0]=1,n[5]=1,n[10]=1,n[15]=1,n}function g(){var n=new V(3);return V!=Float32Array&&(n[0]=0,n[1]=0,n[2]=0),n}function _(n){var r=new V(3);return r[0]=n[0],r[1]=n[1],r[2]=n[2],r}function O(n){var r=n[0],e=n[1],t=n[2];return Math.hypot(r,e,t)}function z(n,r,e){var t=new V(3);return t[0]=n,t[1]=r,t[2]=e,t}function L(n,r){return n[0]=r[0],n[1]=r[1],n[2]=r[2],n}function Mn(n,r,e,t){return n[0]=r,n[1]=e,n[2]=t,n}function ln(n,r,e){return n[0]=r[0]+e[0],n[1]=r[1]+e[1],n[2]=r[2]+e[2],n}function X(n,r,e){return n[0]=r[0]-e[0],n[1]=r[1]-e[1],n[2]=r[2]-e[2],n}function Y(n,r,e){return n[0]=r[0]*e[0],n[1]=r[1]*e[1],n[2]=r[2]*e[2],n}function b(n,r,e){return n[0]=r[0]/e[0],n[1]=r[1]/e[1],n[2]=r[2]/e[2],n}function hn(n,r){return n[0]=Math.ceil(r[0]),n[1]=Math.ceil(r[1]),n[2]=Math.ceil(r[2]),n}function xn(n,r){return n[0]=Math.floor(r[0]),n[1]=Math.floor(r[1]),n[2]=Math.floor(r[2]),n}function nn(n,r,e){return n[0]=Math.min(r[0],e[0]),n[1]=Math.min(r[1],e[1]),n[2]=Math.min(r[2],e[2]),n}function rn(n,r,e){return n[0]=Math.max(r[0],e[0]),n[1]=Math.max(r[1],e[1]),n[2]=Math.max(r[2],e[2]),n}function yn(n,r){return n[0]=Math.round(r[0]),n[1]=Math.round(r[1]),n[2]=Math.round(r[2]),n}function J(n,r,e){return n[0]=r[0]*e,n[1]=r[1]*e,n[2]=r[2]*e,n}function D(n,r,e,t){return n[0]=r[0]+e[0]*t,n[1]=r[1]+e[1]*t,n[2]=r[2]+e[2]*t,n}function en(n,r){var e=r[0]-n[0],t=r[1]-n[1],a=r[2]-n[2];return Math.hypot(e,t,a)}function tn(n,r){var e=r[0]-n[0],t=r[1]-n[1],a=r[2]-n[2];return e*e+t*t+a*a}function an(n){var r=n[0],e=n[1],t=n[2];return r*r+e*e+t*t}function K(n,r){return n[0]=-r[0],n[1]=-r[1],n[2]=-r[2],n}function un(n,r){return n[0]=1/r[0],n[1]=1/r[1],n[2]=1/r[2],n}function U(n,r){var e=r[0],t=r[1],a=r[2],c=e*e+t*t+a*a;return c>0&&(c=1/Math.sqrt(c)),n[0]=r[0]*c,n[1]=r[1]*c,n[2]=r[2]*c,n}function E(n,r){return n[0]*r[0]+n[1]*r[1]+n[2]*r[2]}function B(n,r,e){var t=r[0],a=r[1],c=r[2],s=e[0],i=e[1],f=e[2];return n[0]=a*f-c*i,n[1]=c*s-t*f,n[2]=t*i-a*s,n}function dn(n,r,e,t){var a=r[0],c=r[1],s=r[2];return n[0]=a+t*(e[0]-a),n[1]=c+t*(e[1]-c),n[2]=s+t*(e[2]-s),n}function gn(n,r,e,t,a,c){var s=c*c,i=s*(2*c-3)+1,f=s*(c-2)+c,o=s*(c-1),M=s*(3-2*c);return n[0]=r[0]*i+e[0]*f+t[0]*o+a[0]*M,n[1]=r[1]*i+e[1]*f+t[1]*o+a[1]*M,n[2]=r[2]*i+e[2]*f+t[2]*o+a[2]*M,n}function mn(n,r,e,t,a,c){var s=1-c,i=s*s,f=c*c,o=i*s,M=3*c*i,v=3*f*s,l=f*c;return n[0]=r[0]*o+e[0]*M+t[0]*v+a[0]*l,n[1]=r[1]*o+e[1]*M+t[1]*v+a[1]*l,n[2]=r[2]*o+e[2]*M+t[2]*v+a[2]*l,n}function qn(n,r){r=r||1;var e=k()*2*Math.PI,t=k()*2-1,a=Math.sqrt(1-t*t)*r;return n[0]=Math.cos(e)*a,n[1]=Math.sin(e)*a,n[2]=t*r,n}function zn(n,r,e){var t=r[0],a=r[1],c=r[2],s=e[3]*t+e[7]*a+e[11]*c+e[15];return s=s||1,n[0]=(e[0]*t+e[4]*a+e[8]*c+e[12])/s,n[1]=(e[1]*t+e[5]*a+e[9]*c+e[13])/s,n[2]=(e[2]*t+e[6]*a+e[10]*c+e[14])/s,n}function An(n,r,e){var t=r[0],a=r[1],c=r[2];return n[0]=t*e[0]+a*e[3]+c*e[6],n[1]=t*e[1]+a*e[4]+c*e[7],n[2]=t*e[2]+a*e[5]+c*e[8],n}function In(n,r,e){var t=e[0],a=e[1],c=e[2],s=e[3],i=r[0],f=r[1],o=r[2],M=a*o-c*f,v=c*i-t*o,l=t*f-a*i,h=a*l-c*v,m=c*M-t*l,y=t*v-a*M,x=s*2;return M*=x,v*=x,l*=x,h*=2,m*=2,y*=2,n[0]=i+M+h,n[1]=f+v+m,n[2]=o+l+y,n}function Tn(n,r,e,t){var a=[],c=[];return a[0]=r[0]-e[0],a[1]=r[1]-e[1],a[2]=r[2]-e[2],c[0]=a[0],c[1]=a[1]*Math.cos(t)-a[2]*Math.sin(t),c[2]=a[1]*Math.sin(t)+a[2]*Math.cos(t),n[0]=c[0]+e[0],n[1]=c[1]+e[1],n[2]=c[2]+e[2],n}function wn(n,r,e,t){var a=[],c=[];return a[0]=r[0]-e[0],a[1]=r[1]-e[1],a[2]=r[2]-e[2],c[0]=a[2]*Math.sin(t)+a[0]*Math.cos(t),c[1]=a[1],c[2]=a[2]*Math.cos(t)-a[0]*Math.sin(t),n[0]=c[0]+e[0],n[1]=c[1]+e[1],n[2]=c[2]+e[2],n}function Fn(n,r,e,t){var a=[],c=[];return a[0]=r[0]-e[0],a[1]=r[1]-e[1],a[2]=r[2]-e[2],c[0]=a[0]*Math.cos(t)-a[1]*Math.sin(t),c[1]=a[0]*Math.sin(t)+a[1]*Math.cos(t),c[2]=a[2],n[0]=c[0]+e[0],n[1]=c[1]+e[1],n[2]=c[2]+e[2],n}function Pn(n,r){var e=n[0],t=n[1],a=n[2],c=r[0],s=r[1],i=r[2],f=Math.sqrt(e*e+t*t+a*a),o=Math.sqrt(c*c+s*s+i*i),M=f*o,v=M&&E(n,r)/M;return Math.acos(Math.min(Math.max(v,-1),1))}function Vn(n){return n[0]=0,n[1]=0,n[2]=0,n}function Bn(n){return"vec3("+n[0]+", "+n[1]+", "+n[2]+")"}function $n(n,r){return n[0]===r[0]&&n[1]===r[1]&&n[2]===r[2]}function Qn(n,r){var e=n[0],t=n[1],a=n[2],c=r[0],s=r[1],i=r[2];return Math.abs(e-c)<=C*Math.max(1,Math.abs(e),Math.abs(c))&&Math.abs(t-s)<=C*Math.max(1,Math.abs(t),Math.abs(s))&&Math.abs(a-i)<=C*Math.max(1,Math.abs(a),Math.abs(i))}var W=X,pn=Y,Dn=b,Un=en,En=tn,cn=O,Ln=an,Yn=function(){var n=g();return function(r,e,t,a,c,s){var i,f;for(e||(e=3),t||(t=0),a?f=Math.min(a*e+t,r.length):f=r.length,i=t;i<f;i+=e)n[0]=r[i],n[1]=r[i+1],n[2]=r[i+2],c(n,n,s),r[i]=n[0],r[i+1]=n[1],r[i+2]=n[2];return r}}(),_n=Object.freeze({__proto__:null,add:ln,angle:Pn,bezier:mn,ceil:hn,clone:_,copy:L,create:g,cross:B,dist:Un,distance:en,div:Dn,divide:b,dot:E,equals:Qn,exactEquals:$n,floor:xn,forEach:Yn,fromValues:z,hermite:gn,inverse:un,len:cn,length:O,lerp:dn,max:rn,min:nn,mul:pn,multiply:Y,negate:K,normalize:U,random:qn,rotateX:Tn,rotateY:wn,rotateZ:Fn,round:yn,scale:J,scaleAndAdd:D,set:Mn,sqrDist:En,sqrLen:Ln,squaredDistance:tn,squaredLength:an,str:Bn,sub:W,subtract:X,transformMat3:An,transformMat4:zn,transformQuat:In,zero:Vn});function sn(){var n=new V(4);return V!=Float32Array&&(n[0]=0,n[1]=0,n[2]=0,n[3]=0),n}function Rn(n,r,e,t,a){return n[0]=r,n[1]=e,n[2]=t,n[3]=a,n}function Cn(n,r,e){return n[0]=r[0]*e,n[1]=r[1]*e,n[2]=r[2]*e,n[3]=r[3]*e,n}function Nn(n,r){var e=r[0],t=r[1],a=r[2],c=r[3],s=e*e+t*t+a*a+c*c;return s>0&&(s=1/Math.sqrt(s)),n[0]=e*s,n[1]=t*s,n[2]=a*s,n[3]=c*s,n}(function(){var n=sn();return function(r,e,t,a,c,s){var i,f;for(e||(e=4),t||(t=0),a?f=Math.min(a*e+t,r.length):f=r.length,i=t;i<f;i+=e)n[0]=r[i],n[1]=r[i+1],n[2]=r[i+2],n[3]=r[i+3],c(n,n,s),r[i]=n[0],r[i+1]=n[1],r[i+2]=n[2],r[i+3]=n[3];return r}})();function H(){var n=new V(4);return V!=Float32Array&&(n[0]=0,n[1]=0,n[2]=0),n[3]=1,n}function On(n,r,e){e=e*.5;var t=Math.sin(e);return n[0]=t*r[0],n[1]=t*r[1],n[2]=t*r[2],n[3]=Math.cos(e),n}function G(n,r,e,t){var a=r[0],c=r[1],s=r[2],i=r[3],f=e[0],o=e[1],M=e[2],v=e[3],l,h,m,y,x;return h=a*f+c*o+s*M+i*v,h<0&&(h=-h,f=-f,o=-o,M=-M,v=-v),1-h>C?(l=Math.acos(h),m=Math.sin(l),y=Math.sin((1-t)*l)/m,x=Math.sin(t*l)/m):(y=1-t,x=t),n[0]=y*a+x*f,n[1]=y*c+x*o,n[2]=y*s+x*M,n[3]=y*i+x*v,n}function fn(n,r){var e=r[0]+r[4]+r[8],t;if(e>0)t=Math.sqrt(e+1),n[3]=.5*t,t=.5/t,n[0]=(r[5]-r[7])*t,n[1]=(r[6]-r[2])*t,n[2]=(r[1]-r[3])*t;else{var a=0;r[4]>r[0]&&(a=1),r[8]>r[a*3+a]&&(a=2);var c=(a+1)%3,s=(a+2)%3;t=Math.sqrt(r[a*3+a]-r[c*3+c]-r[s*3+s]+1),n[a]=.5*t,t=.5/t,n[3]=(r[c*3+s]-r[s*3+c])*t,n[c]=(r[c*3+a]+r[a*3+c])*t,n[s]=(r[s*3+a]+r[a*3+s])*t}return n}var j=Cn,S=Nn;(function(){var n=g(),r=z(1,0,0),e=z(0,1,0);return function(t,a,c){var s=E(a,c);return s<-.999999?(B(n,r,a),cn(n)<1e-6&&B(n,e,a),U(n,n),On(t,n,Math.PI),t):s>.999999?(t[0]=0,t[1]=0,t[2]=0,t[3]=1,t):(B(n,a,c),t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=1+s,S(t,t))}})();(function(){var n=H(),r=H();return function(e,t,a,c,s,i){return G(n,t,s,i),G(r,a,c,i),G(e,n,r,2*i*(1-i)),e}})();(function(){var n=on();return function(r,e,t,a){return n[0]=t[0],n[3]=t[1],n[6]=t[2],n[1]=a[0],n[4]=a[1],n[7]=a[2],n[2]=-e[0],n[5]=-e[1],n[8]=-e[2],S(r,fn(r,n))}})();function Xn(n,r,e){const t=_(n),a=_(r);U(t,t),U(a,a);const c=Math.abs(t[0])<.9?z(1,0,0):z(0,1,0),s=B(g(),t,c);U(s,s);const i=E(a,s),f=B(g(),s,a),o=E(f,t),v=(Math.atan2(o,i)+Math.PI)/(2*Math.PI),l=Math.round(v*32767)&32767;return(e>0?1:0)<<15|l}var N=(n=>(n.Uncompressed="none",n.Angle16Bits="angle16bits",n.Quaternion12Bits="quaternion12bits",n))(N||{});function Zn(n,r,e,t,a,c,s){const i=new Uint16Array(n*8),f=z(1/0,1/0,1/0),o=z(-1/0,-1/0,-1/0);if(!c||!s)for(let v=0;v<r.length;v+=3)f[0]=Math.min(f[0],r[v]),f[1]=Math.min(f[1],r[v+1]),f[2]=Math.min(f[2],r[v+2]),o[0]=Math.max(o[0],r[v]),o[1]=Math.max(o[1],r[v+1]),o[2]=Math.max(o[2],r[v+2]);else L(f,c),L(o,s);const M=W(g(),o,f);for(let v=0;v<n;v++){const l=v*3,h=v*4,m=v*2,y=v*8,x=(r[l]-f[0])/M[0],u=(r[l+1]-f[1])/M[1],q=(r[l+2]-f[2])/M[2];i[y]=x*65535,i[y+1]=u*65535,i[y+2]=q*65535;const I=z(e[l],e[l+1],e[l+2]),d=z(t[h],t[h+1],t[h+2]),T=t[h+3]>0?1:0,A=Xn(I,d,T);i[y+3]=A;const $=e[l],p=e[l+1],w=e[l+2],P=1/(Math.abs($)+Math.abs(p)+Math.abs(w));let F=$*P,Q=p*P;if(w<0){const Z=F;F=(1-Math.abs(Q))*(F>=0?1:-1),Q=(1-Math.abs(Z))*(Q>=0?1:-1)}i[y+4]=(F*.5+.5)*65535|0,i[y+5]=(Q*.5+.5)*65535|0,i[y+6]=a[m]*65535|0,i[y+7]=a[m+1]*65535|0}return{compressedData:i,positionMin:f,positionMax:o}}function Gn(n,r,e,t,a,c,s){const i=new Uint16Array(n*8),f=z(1/0,1/0,1/0),o=z(-1/0,-1/0,-1/0);if(!c||!s)for(let h=0;h<r.length;h+=3)f[0]=Math.min(f[0],r[h]),f[1]=Math.min(f[1],r[h+1]),f[2]=Math.min(f[2],r[h+2]),o[0]=Math.max(o[0],r[h]),o[1]=Math.max(o[1],r[h+1]),o[2]=Math.max(o[2],r[h+2]);else L(f,c),L(o,s);const M=W(g(),o,f),v=new Uint16Array(n*3),l=sn();for(let h=0;h<n;h++){const m=h*3,y=h*4,x=h*2,u=h*8,q=(r[m]-f[0])/M[0],I=(r[m+1]-f[1])/M[1],d=(r[m+2]-f[2])/M[2];i[u]=q*65535,i[u+1]=I*65535,i[u+2]=d*65535;const T=z(e[m],e[m+1],e[m+2]),A=z(t[y],t[y+1],t[y+2]),$=t[y+3]>0?1:0;Rn(l,A[0],A[1],A[2],$),kn(v,T,l,Wn),i[u+3]=v[0],i[u+4]=v[1],i[u+5]=v[2],i[u+6]=a[x]*65535|0,i[u+7]=a[x+1]*65535|0}return{compressedData:i,positionMin:f,positionMax:o}}function Hn(n,r,e,t,a){const c=r&4095|(e&15)<<12,s=e>>4&255|(t&255)<<8,i=t>>8&15|(a&4095)<<4;return n[0]=c,n[1]=s,n[2]=i,n}function R(n,r){const e=(1<<r)-1;return Math.round((n*.5+.5)*e)}function Jn(n,r,e,t,a){const c=R(r,12),s=R(e,12),i=R(t,12),f=R(a,12);return Hn(n,c,s,i,f)}function Kn(n,r,e,t,a,c,s,i,f,o){return n[0]=r,n[1]=e,n[2]=t,n[3]=a,n[4]=c,n[5]=s,n[6]=i,n[7]=f,n[8]=o,n}const Wn={TMP0:g(),TMP1:g(),TMP2:g(),MAT0:vn(),F0:z(0,0,1),F1:z(2,-2,-2),F2:z(2,2,-2),Q0:z(1,0,0),Q1:z(-2,2,-2),Q2:z(-2,2,2),qTangent:H()};function Sn(n,r,e,t,a){const c=B(t.TMP0,r,e),s=Kn(t.MAT0,e[0],e[1],e[2],c[0],c[1],c[2],r[0],r[1],r[2]);fn(n,s),S(n,n),n[3]<0&&j(n,n,-1);const i=1/((1<<a-1)-1);if(n[3]<i){n[3]=i;const M=Math.sqrt(1-i*i);n[0]*=M,n[1]*=M,n[2]*=M}const f=e[3]>0?B(t.TMP1,e,r):B(t.TMP1,r,e),o=B(t.TMP2,e,r);return E(o,f)<0&&j(n,n,-1),n}function kn(n,r,e,t){const a=Sn(t.qTangent,r,e,t,12);return Jn(n,a[0],a[1],a[2],a[3])}function jn(n,r,e,t,a,c,s,i,f,o,M){const v=o*M;let l=g(),h=g(),m=g(),y=g();for(let x=0;x<c;x++)for(let u=0;u<s;u++){D(l,n,r,t*x/c),D(l,l,e,a*u/s),D(h,l,r,t/c),D(m,h,e,a/s),D(y,l,e,a/s);const q=x*s+u,I=q*4,d=I*3;f[d+0]=l[0],f[d+1]=l[1],f[d+2]=l[2],f[d+3]=h[0],f[d+4]=h[1],f[d+5]=h[2],f[d+6]=m[0],f[d+7]=m[1],f[d+8]=m[2],f[d+9]=y[0],f[d+10]=y[1],f[d+11]=y[2];const T=q*6;i[T+0]=v+I+0,i[T+1]=v+I+2,i[T+2]=v+I+1,i[T+3]=v+I+0,i[T+4]=v+I+3,i[T+5]=v+I+2}}function bn(n,r,e,t,a,c,s,i,f,o,M,v,l){const h=s.length/3,m=O(Y(g(),r,t)),y=O(Y(g(),e,t));n=Y(g(),n,t),jn(n,r,e,m,y,c,c,M,s,l,h);{const x=g(),u=g(),q=g(),I=g(),d=g(),T=J(g(),t,.5),A=X(g(),T,[a,a,a]),$=K(g(),A);for(let p=0;p<h;p++){const w=p*3,P=p*2,F=p*4;x[0]=s[w],x[1]=s[w+1],x[2]=s[w+2],rn(d,$,x),nn(d,A,d),X(u,x,d),U(u,u),D(x,d,u,a),s[w]=x[0],s[w+1]=x[1],s[w+2]=x[2],o[P]=x[v[0]]/t[v[0]]+.5,o[P+1]=x[v[1]]/t[v[1]]+.5,i[w]=u[0],i[w+1]=u[1],i[w+2]=u[2],L(q,r),U(q,q);const Q=E(q,u);D(q,q,u,-Q),U(q,q),B(I,u,q);const Z=E(I,e)>0?1:-1;f[F]=q[0],f[F+1]=q[1],f[F+2]=q[2],f[F+3]=Z}}}self.onmessage=async n=>{for(;!_n;)await new Promise(P=>setTimeout(P,10));const r=performance.now(),{start:e,right:t,up:a,uvIndex:c,size:s,radius:i,resolution:f,faceIndex:o,numVerticesPerFace:M,numIndicesPerFace:v,quantizationFormat:l}=n.data,h=z(e[0],e[1],e[2]),m=z(t[0],t[1],t[2]),y=z(a[0],a[1],a[2]),x=z(s[0],s[1],s[2]),u=new Float32Array(M*3),q=new Float32Array(M*3),I=new Float32Array(M*4),d=new Float32Array(M*2),T=new Uint32Array(v);bn(h,m,y,x,i,f,u,q,I,d,T,c,o);let A={indices:T,numVertices:M,vertexBytes:0};const $=[T.buffer];if(l!==N.Uncompressed){let P=J(g(),x,.5),F=K(g(),P),Q;switch(l){case N.Quaternion12Bits:Q=Gn(M,u,q,I,d,F,P),A.vertexBytes=16;break;case N.Angle16Bits:default:Q=Zn(M,u,q,I,d,F,P),A.vertexBytes=16;break}A.quantizedData=Q.compressedData,A.positionMin=_(F),A.positionMax=_(P),$.push(A.quantizedData.buffer)}else A.positions=u,A.normals=q,A.tangents=I,A.uvs=d,A.vertexBytes=3*4+3*4+4*4+2*4,$.push(u.buffer,q.buffer,I.buffer,d.buffer);const w=(performance.now()-r).toFixed(2);console.log(`Face generation time: ${w} milliseconds`),self.postMessage({faceIndex:o,...A},{transfer:$})};
//# sourceMappingURL=boxFaceWorker-teeneu2t.js.map
