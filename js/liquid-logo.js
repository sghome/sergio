/* AD19 liquid surface. Original shader inspired by prinzipiell/tsl/volatile-nexus.
 * Uses the existing SVG silhouette; no external runtime dependencies. */
(() => {
  'use strict';
  const source = document.querySelector('#icon-menu path');
  if (!source) return;
  const style = document.createElement('style');
  style.textContent = `
    .liquid-logo { position:fixed; inset:0; width:100%; height:100%; pointer-events:none; z-index:1; }
    .liquid-ready .pieces { opacity:0!important; }
    .liquid-ready #parallax { background-image:none; pointer-events:none; }
    .liquid-ready .content { z-index:2; }
    .liquid-ready .overlay { z-index:1; }
  `;
  document.head.append(style);
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-logo';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Logo AD19 con superficie líquida interactiva');
  document.body.prepend(canvas);
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) { canvas.remove(); return; }
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `
    precision mediump float;
    uniform sampler2D logo;
    uniform vec2 resolution, pointer;
    uniform float time, active, impulse;
    float shape(vec2 p){return texture2D(logo,p).a;}
    vec2 warp(vec2 p){
      vec2 d=p-pointer;
      float r=length(d);
      vec2 flow=vec2(sin(p.y*17.+time*.65),cos(p.x*15.-time*.55))*.006;
      flow+=d/(r+.04)*sin(r*38.-time*3.)*exp(-r*7.)*(active*.023+impulse*.018);
      return p+flow;
    }
    float heightAt(vec2 p){
      p=warp(p);
      float a=shape(p), s=0.;
      for(int i=0;i<8;i++){
        float angle=float(i)*.785398;
        s+=shape(p+vec2(cos(angle),sin(angle))*.012);
      }
      return a*.45+s/8.*.55;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      float size=min(resolution.x*.76,resolution.y*.65);
      vec2 p=(gl_FragCoord.xy-resolution*.5)/size+.5;
      vec3 bg=vec3(.008,.012,.019)+vec3(.018,.026,.036)*exp(-length((uv-.5)*vec2(1.,1.3))*4.);
      if(p.x<0.||p.y<0.||p.x>1.||p.y>1.){gl_FragColor=vec4(bg,1.);return;}
      float a=shape(warp(p));
      float e=.002;
      vec2 slope=vec2(heightAt(p+vec2(e,0.))-heightAt(p-vec2(e,0.)),heightAt(p+vec2(0.,e))-heightAt(p-vec2(0.,e)))/e;
      slope+=vec2(cos(p.x*14.+time*.7),sin(p.y*13.-time*.6))*.65;
      slope+=(p-pointer)*exp(-length(p-pointer)*8.)*active*7.;
      vec3 n=normalize(vec3(-slope*.1,1.));
      vec3 reflected=reflect(vec3(0.,0.,-1.),n);
      float ribbon=pow(max(0.,sin(reflected.x*7.+reflected.y*3.+time*.18)),12.);
      float light=pow(max(dot(n,normalize(vec3(-.6,.8,1.))),0.),30.);
      float rim=pow(1.-n.z,2.);
      vec3 metal=mix(vec3(.065,.12,.15),vec3(.46,.68,.72),n.y*.5+.5);
      metal+=ribbon*vec3(.76,.92,1.)+light*vec3(1.,.87,.68)+rim*vec3(.35,.8,.72);
      metal+=pow(max(0.,dot(n,normalize(vec3(.9,-.4,.7)))),24.)*vec3(.45,.28,.7);
      gl_FragColor=vec4(mix(bg,metal,smoothstep(.08,.8,a)),1.);
    }
  `;
  function compile(type, text) {
    const shader=gl.createShader(type); gl.shaderSource(shader,text); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  let program;
  try {
    program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch(error) { console.warn('AD19 liquid renderer:',error); canvas.remove(); return; }
  gl.useProgram(program);
  const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uniforms={};
  for(const key of ['logo','resolution','pointer','time','active','impulse']) uniforms[key]=gl.getUniformLocation(program,key);
  const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg'); svg.setAttribute('viewBox','0 0 78 78');
  svg.setAttribute('width','1024'); svg.setAttribute('height','1024');
  const path=source.cloneNode(true); path.removeAttribute('transform'); path.setAttribute('fill','white');
  path.removeAttribute('style'); svg.append(path);
  const image=new Image();
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let pointer=[.5,.5], target=[.5,.5], active=0, targetActive=0, impulse=0, frame=0, start=performance.now();
  function resize(){
    const ratio=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(innerWidth*ratio); canvas.height=Math.round(innerHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  function locate(event){
    const size=Math.min(innerWidth*.76,innerHeight*.65);
    target=[(event.clientX-innerWidth*.5)/size+.5,(innerHeight*.5-event.clientY)/size+.5];
    targetActive=1;
    if(motion.matches) draw(performance.now());
  }
  function draw(now){
    pointer=pointer.map((v,i)=>v+(target[i]-v)*.09); active+=(targetActive-active)*.07; impulse*=.95;
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
    gl.uniform2f(uniforms.pointer,...pointer);
    gl.uniform1f(uniforms.time,motion.matches?0:(now-start)/1000);
    gl.uniform1f(uniforms.active,motion.matches?0:active); gl.uniform1f(uniforms.impulse,impulse);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  function loop(now){draw(now);frame=requestAnimationFrame(loop);}
  function resume(){cancelAnimationFrame(frame);if(!document.hidden&&!motion.matches) frame=requestAnimationFrame(loop);else draw(performance.now());}
  image.onload=()=>{
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    URL.revokeObjectURL(url);resize();document.body.classList.add('liquid-ready');
    addEventListener('resize',()=>{resize();draw(performance.now());});
    addEventListener('pointermove',locate,{passive:true});
    addEventListener('pointerdown',e=>{locate(e);impulse=1;},{passive:true});
    document.documentElement.addEventListener('pointerleave',()=>targetActive=0);
    addEventListener('pointerup',e=>{if(e.pointerType==='touch')targetActive=0;},{passive:true});
    document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);document.body.classList.remove('liquid-ready');canvas.remove();});
    resume();
  };
  image.onerror=()=>{URL.revokeObjectURL(url);canvas.remove();};
  image.src=url;
})();
