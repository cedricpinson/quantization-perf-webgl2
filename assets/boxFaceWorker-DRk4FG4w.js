let e;(async()=>e=(await import("./index-voPHfvpD.js")).vec3)();function Q(b,g,u,d,m,F,l,s,a,P,w){const f=P*w;let A=e.create(),x=e.create(),I=e.create(),M=e.create();for(let n=0;n<F;n++)for(let t=0;t<l;t++){e.scaleAndAdd(A,b,g,d*n/F),e.scaleAndAdd(A,A,u,m*t/l),e.scaleAndAdd(x,A,g,d/F),e.scaleAndAdd(I,x,u,m/l),e.scaleAndAdd(M,A,u,m/l);const r=n*l+t,o=r*4,c=o*3;a[c+0]=A[0],a[c+1]=A[1],a[c+2]=A[2],a[c+3]=x[0],a[c+4]=x[1],a[c+5]=x[2],a[c+6]=I[0],a[c+7]=I[1],a[c+8]=I[2],a[c+9]=M[0],a[c+10]=M[1],a[c+11]=M[2];const V=r*6;s[V+0]=f+o+0,s[V+1]=f+o+2,s[V+2]=f+o+1,s[V+3]=f+o+0,s[V+4]=f+o+3,s[V+5]=f+o+2}}function $(b,g,u,d,m,F,l,s,a,P,w,f,A){const x=l.length/3,I=e.length(e.multiply(e.create(),g,d)),M=e.length(e.multiply(e.create(),u,d));b=e.multiply(e.create(),b,d),Q(b,g,u,I,M,F,F,w,l,A,x);{const n=e.create(),t=e.create(),r=e.create(),o=e.create(),c=e.create(),V=e.scale(e.create(),d,.5),v=e.subtract(e.create(),V,[m,m,m]),z=e.negate(e.create(),v);for(let T=0;T<x;T++){const y=T*3,C=T*2,U=T*4;n[0]=l[y],n[1]=l[y+1],n[2]=l[y+2],e.max(c,z,n),e.min(c,v,c),e.subtract(t,n,c),e.normalize(t,t),e.scaleAndAdd(n,c,t,m),l[y]=n[0],l[y+1]=n[1],l[y+2]=n[2],P[C]=n[f[0]]/d[f[0]]+.5,P[C+1]=n[f[1]]/d[f[1]]+.5,s[y]=t[0],s[y+1]=t[1],s[y+2]=t[2],e.copy(r,g),e.normalize(r,r);const G=e.dot(r,t);e.scaleAndAdd(r,r,t,-G),e.normalize(r,r),e.cross(o,t,r);const H=e.dot(o,u)>0?1:-1;a[U]=r[0],a[U+1]=r[1],a[U+2]=r[2],a[U+3]=H}}}self.onmessage=async b=>{for(;!e;)await new Promise(z=>setTimeout(z,10));const g=performance.now(),{start:u,right:d,up:m,uvIndex:F,size:l,radius:s,resolution:a,faceIndex:P,numVerticesPerFace:w,numIndicesPerFace:f}=b.data,A=e.fromValues(u[0],u[1],u[2]),x=e.fromValues(d[0],d[1],d[2]),I=e.fromValues(m[0],m[1],m[2]),M=e.fromValues(l[0],l[1],l[2]),n=new Float32Array(w*3),t=new Float32Array(w*3),r=new Float32Array(w*4),o=new Float32Array(w*2),c=new Uint32Array(f);$(A,x,I,M,s,a,n,t,r,o,c,F,P);const v=(performance.now()-g).toFixed(2);console.log(`Face generation time: ${v} milliseconds`),self.postMessage({faceIndex:P,positions:n,normals:t,tangents:r,uvs:o,indices:c},{transfer:[n.buffer,t.buffer,r.buffer,o.buffer,c.buffer]})};
//# sourceMappingURL=boxFaceWorker-DRk4FG4w.js.map
