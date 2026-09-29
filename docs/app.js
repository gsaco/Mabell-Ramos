'use strict';
const titles=['Portada','Chocotejas','Alfajores','Bombones','Trufas y donas','Paquetes de regalo','Bocaditos dulces','Catering dulce','Catering salado','Arma tu selección','Panes personales','Bebidas','Especiales por encargo','Cómo hacer tu pedido'];
const select=document.querySelector('#page-select'), image=document.querySelector('#page'), previous=document.querySelector('#previous'), next=document.querySelector('#next'), counter=document.querySelector('#counter'), zoom=document.querySelector('#zoom'), viewport=document.querySelector('#viewport'), status=document.querySelector('#status');
let current=0;
titles.forEach((title,i)=>select.add(new Option(`${String(i+1).padStart(2,'0')} · ${title}`,i)));
function loaded(){status.hidden=true;}
image.addEventListener('load',loaded);
image.addEventListener('error',()=>{status.textContent='No se pudo cargar esta página. Reintenta o descarga el PDF original.';status.hidden=false;});
function show(index){current=Math.max(0,Math.min(titles.length-1,index));select.value=current;counter.textContent=`${current+1} / ${titles.length}`;previous.disabled=current===0;next.disabled=current===titles.length-1;status.textContent='Cargando página…';status.hidden=false;image.alt=`Página ${current+1}: ${titles[current]} — catálogo de Mabell Ramos`;image.src=`assets/pagina-${String(current+1).padStart(2,'0')}.webp`;viewport.scrollTo(0,0);if(image.complete&&image.naturalWidth)loaded();history.replaceState(null,'',`#pagina-${current+1}`);}
select.addEventListener('change',()=>show(Number(select.value)));previous.addEventListener('click',()=>show(current-1));next.addEventListener('click',()=>show(current+1));zoom.addEventListener('click',()=>{const expanded=viewport.classList.toggle('expanded');zoom.setAttribute('aria-pressed',String(expanded));zoom.textContent=expanded?'Ajustar −':'Ampliar ＋';viewport.scrollTo(0,0);});
document.addEventListener('keydown',event=>{if(event.target.tagName==='SELECT'||viewport.classList.contains('expanded'))return;if(event.key==='ArrowRight'){event.preventDefault();show(current+1);}if(event.key==='ArrowLeft'){event.preventDefault();show(current-1);}});
function fromHash(){const match=location.hash.match(/^#pagina-(\d+)$/);show(match?Number(match[1])-1:0);}window.addEventListener('hashchange',fromHash);fromHash();
