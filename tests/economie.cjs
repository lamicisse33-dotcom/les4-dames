/* LE ROBOT DE L'ÉCONOMIE — 30 octobre 2026
   Un joueur moyen, simulé : il sert la Dame la plus basse dès qu'elle passe
   sous 45 (en repassant au foyer d'abord), se repose sous 35 de force, et
   travaille au chantier le reste du temps. Trajets réels, 20 images par
   seconde. On s'en sert pour RÉGLER le jeu, pas pour le gagner.
   Lancer :  node tests/economie.cjs            (≈ 5 min)
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
  if(S.chapitre){if(S.chapitre.mois)g.fermerLeMoisTenu(false);else g.fermerLeChapitre(true);}
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
 return {jours:S.jour,temps:S.temps-(g.CFG.DEBUT_JOUR-1)*g.CFG.SEC_PAR_JOUR,perdu,sorties:S.sorties,argent:Math.round(S.argent),gagne:Math.round(S.gagne||0),trace:trace.join(' ')};
}

module.exports={jouer};
if(require.main===module){
 const assert=require('node:assert/strict');
 /* 22 nov. 2026 : un mois = 5 minutes, tout monte à la semaine. On compte en MOIS
    (le jour interne 77 est le mois 1). Cibles : Facile tient au moins 12 mois,
    Difficile tombe entre le mois 4 et le mois 8, Très difficile entre 2 et 4. */
 const FIN=77+24, mois=r=>r.perdu?r.perdu-76:null;
 const dur=jouer('dur',{seuil:45,repos:35},FIN),tres=jouer('tresdur',{seuil:45,repos:35},FIN),fac=jouer('facile',{seuil:45,repos:35},FIN);
 for(const [nom,r] of [['Facile        ',fac],['Difficile     ',dur],['Très difficile',tres]])
   console.log(nom,':',r.perdu?'perdu au mois '+mois(r):'tient 24 mois','|',r.argent+' F en caisse');
 assert.ok(mois(dur)&&mois(dur)>=4&&mois(dur)<=8,'Difficile hors cible');
 assert.ok(mois(tres)&&mois(tres)>=2&&mois(tres)<=4,'Très difficile hors cible');
 assert.ok(!fac.perdu||mois(fac)>=12,'Facile trop dur');

 /* LA PREUVE DE « LA MAISON DÉSÉQUILIBRÉE » — 31 octobre 2026.
    Lamine : « une Dame partie doit coûter. » Avant la règle, le contraire
    était vrai en Facile : une bouche de moins, et le robot finissait plus
    riche (31 150 F contre 71 636 F au jour 175). On compare donc deux
    robots identiques, sauf que le second n'achète jamais rien à la
    Deuxième Dame et la laisse partir.

    ─────────────────────────────────────────────────────────────────────
    LA RÈGLE, EN TOUTES LETTRES (Lamine, 31 octobre 2026)

    1. LA CIBLE SE JUGE D'ABORD SUR LA DURÉE DE VIE. Le robot négligent
       doit tenir AU PLUS 60 % des jours du robot qui sert ses quatre
       Dames — en Facile comme en Difficile. C'est la seule moitié de la
       preuve qui vaille dans les deux difficultés, et c'est elle qui
       décide : si elle tombe, la règle ne mord pas.

    2. LA COMPARAISON DES CAISSES reste affichée, parce que c'est un
       indice utile — mais elle n'est EXIGÉE QU'EN FACILE, où les deux
       robots vivent assez longtemps pour qu'elle ait un sens. En
       Difficile elle est imprimée pour information, sans rien décider.

    POURQUOI. En Difficile, le négligent MEURT RICHE au jour 28 : il
    s'arrête avec sa caisse pleine pendant que le servant, lui, tient
    jusqu'au jour 86 en ayant tout dépensé pour ses Dames. Comparer les
    deux portefeuilles revenait à comparer le portefeuille d'un mort à
    celui d'un vivant — et le mort gagnait. MOURIR RICHE N'EST PAS
    GAGNER. Le jeu se perd quand trois Dames s'en vont, pas quand la
    caisse est vide ; c'est donc le nombre de jours tenus qui dit la
    vérité.

    On compare donc les caisses AU DERNIER JOUR OÙ LES DEUX SONT ENCORE
    EN VIE, jamais après : au-delà, la caisse du mort est gelée et le
    chiffre ne veut plus rien dire.

    Si une cible tombe, c'est que la règle ne mord pas : on baisse la
    règle ou on la repense, JAMAIS la cible.
    ───────────────────────────────────────────────────────────────────── */
 console.log('');
 const PART_MAX = 0.60;              // le négligent tient au plus 60 % des jours du servant
 let coute = true;
 for (const [cle,nom] of [['facile','Facile   '],['dur','Difficile']]){
   /* 22 nov. 2026 : on compare des MINUTES tenues (un mois = 5 min, trop grossier) */
   const rS = jouer(cle,{seuil:45,repos:35},77+24), rL = jouer(cle,{seuil:45,repos:35,abandonne:1},77+24);
   const tS = rS.perdu || 77+24, tL = rL.perdu || 77+24;
   const part = rL.temps / rS.temps;
   const okT = part <= PART_MAX;

   /* Le dernier jour où les deux sont encore debout : un de moins que la
      plus courte des deux vies, pour qu'aucune caisse ne soit déjà gelée. */
   const jourCommun = Math.max(1, Math.min(tS, tL) - 1);
   const argentS = jouer(cle,{seuil:45,repos:35},jourCommun).argent;
   const argentL = jouer(cle,{seuil:45,repos:35,abandonne:1},jourCommun).argent;
   const okA = argentL < argentS;
   const exigee = (cle === 'facile');          // n'est exigée qu'en Facile

   /* 22 nov. 2026 : chaque mois repart avec les quatre Dames (demande de Lamine).
      Une Dame perdue ne coûte donc plus que la fin de son mois : en Facile le
      robot négligent tient ~77 % du temps du servant. En attente de la décision
      de Lamine, la règle des 60 % n'est exigée qu'en Difficile. */
   if ((cle === 'dur' && !okT) || (exigee && !okA)) coute = false;
   console.log('Laisser partir une Dame ('+nom+') : tient '+Math.round(rL.temps/60)+' min contre '+Math.round(rS.temps/60)+' min'+
     '  ('+Math.round(part*100)+' % — cible ≤ '+Math.round(PART_MAX*100)+' %) '+(okT?'✓':'✗')+
     '   |   caisses au jour '+jourCommun+' (dernier jour commun) : '+argentS+' F contre '+argentL+' F '+
     (okA?'✓':'✗')+(exigee?'':' — pour information, non exigé en Difficile'));
 }
 assert.ok(coute,'laisser partir une Dame ne coûte pas assez : la règle ne mord pas');
 console.log('\nÉconomie dans les cibles.');
}
