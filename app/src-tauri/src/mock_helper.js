(function(){var r=document.documentElement;var L=[];function reg(a,b,c){L.push([a,b,c]);}
function t(v){var q=document.documentElement;if(q&&(v==='dark'||v==='light')){q.setAttribute('data-theme',v);q.style.colorScheme=v;}}
try{var m=/[?&]kona-theme=(dark|light)/.exec(location.search);if(m)t(m[1]);}catch(e){}
reg('message',function(e){var d=e.data;if(e.source===parent&&d&&d.kona==='theme')t(d.value);});
reg('wheel',function(e){if(!e.ctrlKey)return;e.preventDefault();parent.postMessage({kona:'wheel',dy:e.deltaY,x:e.clientX,y:e.clientY},'*');},{passive:false});
reg('keydown',function(e){if(e.key==='Escape')parent.postMessage({kona:'escape'},'*');});
/* Pick mode: the sheet turns it on; clicks and links of the page are paused, the part under the pointer is outlined and named, and a click reports the part (its name, its words, its place in the page and the sizes it has). Pins are drawn here, inside the page, so they follow it when it scrolls. */
var on=false,hov=null,act=null,pins=[],host=null,shadow=null,hbox=null,abox=null,pinBox=null,cur=null,raf=0,tick=0,lastHov='',lastAct='',style=null,GREEN='#0f766e';
function say(o){try{parent.postMessage(o,'*');}catch(e){}}
function ensure(){
  var root=document.documentElement;
  if(!root)return false;
  if(!host||host.parentNode!==root){
    host=document.createElement('div');
    host.style.cssText='all:initial;position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;display:block;';
    shadow=host.attachShadow({mode:'closed'});
    hbox=document.createElement('div');abox=document.createElement('div');pinBox=document.createElement('div');
    var base='position:fixed;box-sizing:border-box;display:none;pointer-events:none;';
    hbox.style.cssText=base+'border:2px dashed '+GREEN+';background:rgba(15,118,110,.10);';
    abox.style.cssText=base+'border:2px solid '+GREEN+';background:rgba(15,118,110,.16);';
    shadow.appendChild(hbox);shadow.appendChild(abox);shadow.appendChild(pinBox);
    root.appendChild(host);
  }
  if(on&&(!style||style.parentNode!==root)){
    style=document.createElement('style');style.textContent='*{cursor:crosshair !important;}';root.appendChild(style);
  }
  return true;
}
function trim(s,n){s=String(s==null?'':s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n):s;}
function sel(el){
  var p=[];
  while(el&&el.nodeType===1&&el!==document.documentElement){
    if(el.id&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(el.id)&&document.querySelectorAll('#'+el.id).length===1){p.unshift('#'+el.id);break;}
    var n=el.tagName.toLowerCase(),i=1,s=el;
    while((s=s.previousElementSibling)){if(s.tagName===el.tagName)i++;}
    p.unshift(n+':nth-of-type('+i+')');
    el=el.parentNode;
  }
  return p.join('>');
}
function four(a,b,c,d){return (a===b&&b===c&&c===d)?a:(a===c&&b===d)?a+' '+b:a+' '+b+' '+c+' '+d;}
function partOf(el){
  if(!el||el.nodeType!==1)return null;
  if(host&&(el===host))return null;
  var q=el.closest?el.closest('[data-part]'):null;
  return q||el;
}
function info(el){
  var cs=getComputedStyle(el),b=el.getBoundingClientRect(),within=[],q=el.parentNode;
  while(q&&q.nodeType===1&&within.length<5){if(q.getAttribute&&q.getAttribute('data-part'))within.unshift(trim(q.getAttribute('data-part'),40));q=q.parentNode;}
  var bw=cs.borderTopWidth;
  return {
    part:trim(el.getAttribute('data-part')||'',60),
    tag:el.tagName.toLowerCase(),
    text:trim(el.innerText||el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.getAttribute('alt')||'',160),
    place:trim(sel(el),400),
    within:within,
    page:trim(location.pathname,300),
    padding:four(cs.paddingTop,cs.paddingRight,cs.paddingBottom,cs.paddingLeft),
    gap:cs.gap==='normal'?'':trim(cs.gap,40),
    radius:trim(cs.borderRadius,60),
    border:(bw==='0px'||cs.borderTopStyle==='none')?'none':trim(bw+' '+cs.borderTopStyle+' '+cs.borderTopColor,80),
    w:Math.round(b.width),h:Math.round(b.height)
  };
}
function place(box,el){
  if(!el||!el.isConnected){box.style.display='none';return false;}
  var b=el.getBoundingClientRect();
  box.style.display='block';box.style.left=b.left+'px';box.style.top=b.top+'px';box.style.width=b.width+'px';box.style.height=b.height+'px';
  return true;
}
function draw(){
  raf=0;
  if(!ensure())return;
  tick++;
  place(hbox,on?hov:null);
  if(act){
    if(!act.isConnected){act=null;abox.style.display='none';lastAct='';say({kona:'gone'});}
    else{
      place(abox,act);
      var b=act.getBoundingClientRect(),k=[b.left,b.top,b.width,b.height,innerWidth,innerHeight].map(Math.round).join(',');
      if(k!==lastAct){lastAct=k;say({kona:'rect',x:b.left,y:b.top,w:b.width,h:b.height,vw:innerWidth,vh:innerHeight});}
    }
  }else abox.style.display='none';
  var page=location.pathname;
  while(pinBox.firstChild)pinBox.removeChild(pinBox.firstChild);
  for(var i=0;i<pins.length;i++){
    var p=pins[i];
    if(p.page!==page)continue;
    if(!p.el||!p.el.isConnected){if(p.el||tick%30===0){try{p.el=document.querySelector(p.place);}catch(e){p.el=null;}}}
    if(!p.el)continue;
    var c=p.el.getBoundingClientRect();
    var d=document.createElement('div');
    d.textContent=String(p.n);
    var x=Math.max(0,Math.min(innerWidth-20,c.left-10)),y=Math.max(0,Math.min(innerHeight-20,c.top-10));
    d.style.cssText='position:fixed;left:'+x+'px;top:'+y+'px;width:20px;height:20px;border-radius:10px;background:'+GREEN+';color:#fff;font:700 12px/20px sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:none;';
    pinBox.appendChild(d);
  }
  if(on||act)raf=requestAnimationFrame(draw);else if(pins.length)setTimeout(go,400);
}
function go(){if(!raf)raf=requestAnimationFrame(draw);}
function setOn(v){
  on=!!v;
  if(!on){hov=null;lastHov='';if(style&&style.parentNode)style.parentNode.removeChild(style);style=null;say({kona:'hover',none:true});}
  go();
}
['click','auxclick','dblclick','mousedown','mouseup','pointerdown','pointerup','contextmenu','submit','touchstart','touchend'].forEach(function(n){
  reg(n,function(e){
    if(!on)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(n==='click'&&e.detail>0){
      var el=partOf(document.elementFromPoint(e.clientX,e.clientY));
      if(!el)return;
      act=el;lastAct='';
      var o=info(el);o.kona='pick';o.vw=innerWidth;o.vh=innerHeight;
      var b=el.getBoundingClientRect();o.x=b.left;o.y=b.top;o.rw=b.width;o.rh=b.height;
      say(o);go();
    }
  },true);
});
reg('mousemove',function(e){
  if(!on)return;
  var el=partOf(document.elementFromPoint(e.clientX,e.clientY));
  if(el===hov)return;
  hov=el;
  if(!el){if(lastHov!==''){lastHov='';say({kona:'hover',none:true});}go();return;}
  var o=info(el);o.kona='hover';lastHov=o.place;say(o);go();
},true);
reg('scroll',function(){if(pins.length||act)go();},true);
reg('resize',function(){if(pins.length||act)go();});
reg('mouseleave',function(){if(on&&hov){hov=null;lastHov='';say({kona:'hover',none:true});go();}},true);
reg('message',function(e){
  var d=e.data;
  if(e.source!==parent||!d||typeof d!=='object')return;
  if(d.kona==='pick')setOn(d.on);
  else if(d.kona==='pins'&&Array.isArray(d.list)){
    pins=[];
    for(var i=0;i<d.list.length&&i<100;i++){var q=d.list[i];if(q&&typeof q.place==='string'&&typeof q.page==='string'&&typeof q.n==='number')pins.push({n:q.n,place:q.place.slice(0,400),page:q.page.slice(0,300),el:null});}
    go();
  }
  else if(d.kona==='clear'){act=null;lastAct='';go();}
});
/* A page that replaces its whole document (document.open) loses the listeners of its window: they are put back, and the sheet is told the helper is ready again */
function install(){for(var i=0;i<L.length;i++){var l=L[i];removeEventListener(l[0],l[1],l[2]);addEventListener(l[0],l[1],l[2]);}}
function again(){hov=null;act=null;lastHov='';lastAct='';host=null;style=null;for(var i=0;i<pins.length;i++)pins[i].el=null;install();try{var m=/[?&]kona-theme=(dark|light)/.exec(location.search);if(m)t(m[1]);}catch(e){}say({kona:'ready'});go();}
try{var oo=Document.prototype.open;Document.prototype.open=function(){var x=oo.apply(this,arguments);setTimeout(again,0);return x;};}catch(e){}
install();
parent.postMessage({kona:'ready'},'*');})();
