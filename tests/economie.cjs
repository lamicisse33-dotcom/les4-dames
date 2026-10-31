/* LE ROBOT DE L'ÉCONOMIE — 30 octobre 2026
   Un joueur moyen, simulé : il sert la Dame la plus basse dès qu'elle passe
   sous 45 (en repassant au foyer d'abord), se repose sous 35 de force, et
   travaille au chantier le reste du temps. Trajets réels, 20 images par
   seconde. On s'en sert pour RÉGLER le jeu, pas pour le gagner.
   Lancer :  node tests/economie.cjs            (≈ 2 min)
   Cibles :  Difficile, perdu entre le jour 80 et 140 ; Très difficile entre
             35 et 80 ; Facile tient 150 jours ; 14 niveaux sur 18 passés
             depuis leur point de reprise en Difficile. */
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function monde(niveau){
 const nodes=new Map();
 function node(id=''){const classes=new Set();return {id,dataset:{},style:{setProperty(){}},children:[],innerHTML:'',textContent:'',className:'',
  classList:{add(...cs){cs.forEach(c=>classes.add(c));},remove(...cs){cs.forEach(c=>classes.delete(c));},contains(c){return classes.has(c);},toggle(c,v){if(v===undefined)v=!classes.has(c);v?classes.add(c):classes.delete(c);}},
  addEventListener(){},setAttribute(){},getAttribute(){return null;},appendChild(c){this.children.push(c);},removeChild(){},remove(){},querySelector(){return node();},querySelectorAll(){return [];},getBoundingClientRect(){return {left:0,top:0,width:1000,height:600};}};}
 const data=new Map();data.set('lqd_niveau',niveau);data.set('lqd_tuto_vu','1');
 const document={body:node('body'),documentElement:node('html'),hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);},createElement:node,addEventListener(){},querySelector(){return node();},querySelectorAll(){return []}};
 const ctx={console,document,navigator:{userAgent:'test',language:'fr',platform:'Linux',maxTouchPoints:0},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},performance:{now:()=>1000},requestAnimationFrame(){},cancelAnimationFrame(){},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},addEventListener(){},innerWidth:1000,innerHeight:600,devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({getPropertyValue:()=>''}),location:{href:'https://x',pathname:'/'},fetch:async()=>({ok:true,json:async()=>[],text:async()=>''}),URL,URLSearchParams,Date,Math,alert(){},confirm:()=>false};
 ctx.window=ctx;vm.createContext(ctx);for(const s of scripts)new vm.Script(s).runInContext(ctx);
 for(const k of ['ouvrirLaMusiqueDeFete','fermerLaMusiqueDeFete','fanfare','parler','couperLaParole','sonBouton','flash','musique','modouDit'])ctx[k]=()=>{};
 return ctx;}
function jouer(niveau,politique,maxJours=200,over={},depart=null){
 const g=monde(niveau);for(const k in over.cfg||{})g.CFG[k]=over.cfg[k];for(const i in over.niv||{})Object.assign(g.NIVEAUX[i],over.niv[i]);if(over.prix)for(const k in g.LIEUX)g.LIEUX[k].prix=Math.round(g.LIEUX[k].prix*over.prix);
 if(depart){g.demarrerA({schema:2,niveau:depart,jours:(depart-1)*10+1,ane:depart>=7,moto:depart>=13,toit:depart>=10});}else g.demarrer();g.gamePaused=false;const S=g.S;if(depart)maxJours=(depart-1)*10+10;
 let t=1000,cible=null,fin=null,perdu=null,trace=[];g.finir=(c)=>{fin=c;S.enCours=false;};const gf=g.faitPartir;g.faitPartir=(i)=>{gf(i);if(S.sorties>=3&&!perdu){perdu=S.jour;S.enCours=false;}};let dernierJour=0;
 const L=g.LIEUX,C=g.CENTRE,CH=g.CHANTIER;
 const aller=(x,y,nom)=>{if(cible===nom&&S.auto)return;const r=g.trajetVers(x,y);if(r&&r.length>=2){S.auto={pts:r,i:1};cible=nom;}};
 while(S.enCours&&S.jour<=maxJours){
  if(S.chapitre)g.fermerLeChapitre(true);
  // décision
  const prix=i=>g.prixDuJour(g.DAMES[i].lieu);
  let urgent=-1,bas=999;for(let i=0;i<4;i++){if(S.parties[i]||politique.abandonne===i)continue;if(S.jauges[i]<bas){bas=S.jauges[i];urgent=i;}}
  const seuil=politique.seuil;
  if(S.enfant&&S.enfant.phase==='libre'&&urgent>=0&&bas<seuil&&S.argent>=prix(urgent)+50)g.envoyerLEnfantSeul();
  if(urgent>=0&&bas<seuil&&S.argent>=prix(urgent)){
    if(!S.foyer)aller(C.x,C.y,'C');else aller(L[g.DAMES[urgent].lieu].x,L[g.DAMES[urgent].lieu].y,'D'+urgent);
  }else if(S.force<politique.repos||(!S.foyer&&S.force<70))aller(C.x,C.y,'C');
  else if(S.nuit>0.5)aller(C.x,C.y,'C');
  else aller(CH.x,CH.y,'CH');
  if(S.zone===cible?.[0]&&cible==='CH')S.auto=null;
  if(S.zone===C&&cible==='C')S.auto=null;
  t+=50;g.last=t-50;g.tourDeBoucle(t);if(S.jour!==dernierJour){dernierJour=S.jour;if(S.jour%25===0)trace.push(S.jour+':'+Math.round(S.argent)+'F/prix'+g.prixDuJour('BANQUE'));}
 }
 return {jours:S.jour,perdu,sorties:S.sorties,argent:Math.round(S.argent),gagne:Math.round(S.gagne||0),trace:trace.join(' ')};
}

module.exports={jouer};
if(require.main===module){
 const assert=require('node:assert/strict');
 const dur=jouer('dur',{seuil:45,repos:35},220),tres=jouer('tresdur',{seuil:45,repos:35},220),fac=jouer('facile',{seuil:45,repos:35},220);
 console.log('Difficile      :',dur.perdu?'perdu jour '+dur.perdu:'tient 220 jours','|',dur.trace);
 console.log('Très difficile :',tres.perdu?'perdu jour '+tres.perdu:'tient 220 jours','|',tres.trace);
 console.log('Facile         :',fac.perdu?'perdu jour '+fac.perdu:'tient 220 jours','|',fac.trace);
 let ok=0,det=[],manques=[];
 for(let n=1;n<=18;n++){
   const r=jouer('dur',{seuil:45,repos:35},200,{},n);
   if(!r.perdu)ok++;else manques.push('niveau '+n+' : perdu jour '+r.perdu+' ('+r.sorties+' Dame'+(r.sorties>1?'s':'')+' partie'+(r.sorties>1?'s':'')+')');
   det.push(n+(r.perdu?'✗':'✓'));
 }
 console.log('Niveaux passés depuis leur reprise (Difficile) :',ok,'/ 18 —',det.join(' '));
 if(manques.length)console.log('   manqués —',manques.join(' | '));
 assert.ok(dur.perdu&&dur.perdu>=80&&dur.perdu<=140,'Difficile hors cible');
 assert.ok(tres.perdu&&tres.perdu>=35&&tres.perdu<=80,'Très difficile hors cible');
 assert.ok(!fac.perdu||fac.perdu>=150,'Facile trop dur');
 assert.ok(ok>=14,'trop de niveaux infranchissables');

 /* LA PREUVE DE « LA MAISON DÉSÉQUILIBRÉE » — 31 octobre 2026.
    Lamine : « une Dame partie doit coûter. » Avant la règle, le contraire
    était vrai en Facile : une bouche de moins, et le robot finissait plus
    riche (31 150 F contre 71 636 F au jour 175). On compare donc deux
    robots identiques, sauf que le second n'achète jamais rien à la
    Deuxième Dame et la laisse partir.

    ATTENTION AU PIÈGE DE LA MESURE, il a failli nous tromper : comparer
    les deux caisses À LA FIN ne prouve rien, parce que les deux parties
    ne finissent pas le même jour. Le négligent meurt tôt avec sa caisse
    pleine ; le servant meurt tard après avoir tout dépensé. On compare
    donc AU MÊME JOUR. Les premières semaines, le négligent est en avance
    — une bouche de moins à nourrir, c'est normal et c'est voulu. Depuis
    le 31 octobre (v13.3), la pénalité d'absence MONTE SUR DEUX JOURS au
    lieu de tomber d'un coup : le rattrapage se fait donc au jour 30, et
    la règle ne doit plus lâcher ensuite (jours 30 et 40).

    Si cette cible tombe, c'est que la règle ne mord pas : on baisse la
    règle ou on la repense, JAMAIS la cible. */
 console.log('');
 const JOURS_PREUVE=[30,40];
 let coute=true;
 for (const [cle,nom] of [['facile','Facile   '],['dur','Difficile']]){
   const tS=jouer(cle,{seuil:45,repos:35},220).perdu||220;
   const tL=jouer(cle,{seuil:45,repos:35,abandonne:1},220).perdu||220;
   const okT=tL<tS;
   let okA=true;const detail=[];
   for(const j of JOURS_PREUVE){
     const a=jouer(cle,{seuil:45,repos:35},j).argent;
     const b=jouer(cle,{seuil:45,repos:35,abandonne:1},j).argent;
     if(b>=a)okA=false;
     detail.push('j'+j+' '+a+'/'+b);
   }
   if(!okA||!okT)coute=false;
   console.log('Laisser partir une Dame ('+nom+') : tient '+tL+' j contre '+tS+' j '+(okT?'✓':'✗')+
     '   |   au même jour, sert/néglige : '+detail.join('  ')+' '+(okA?'✓':'✗'));
 }
 assert.ok(coute,'laisser partir une Dame ne coûte pas : la règle ne mord pas assez');
 console.log('\nÉconomie dans les cibles.');
}
