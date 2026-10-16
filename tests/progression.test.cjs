const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const nodes = new Map();
function node(id = '') {
  const classes = new Set();
  return {id, dataset:{}, style:{setProperty(){}}, children:[], innerHTML:'', textContent:'', className:'',
    classList:{add(...cs){cs.forEach(c=>classes.add(c));}, remove(...cs){cs.forEach(c=>classes.delete(c));},
      contains(c){return classes.has(c);}, toggle(c,v){if(v === undefined)v=!classes.has(c);v?classes.add(c):classes.delete(c);}},
    addEventListener(){}, setAttribute(){}, getAttribute(){return null;}, appendChild(c){this.children.push(c);},
    removeChild(){}, remove(){}, querySelector(){return node();}, querySelectorAll(){return [];},
    getBoundingClientRect(){return {left:0,top:0,width:1000,height:600};}
  };
}
const data = new Map();
const document = {body:node('body'), documentElement:node('html'), hidden:false,
  getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);},
  createElement:node, addEventListener(){}, querySelector(){return node();}, querySelectorAll(){return []}};
const context = {console, document, navigator:{userAgent:'test',language:'fr',platform:'Linux',maxTouchPoints:0},
  localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},
  performance:{now:()=>1000}, requestAnimationFrame(){}, cancelAnimationFrame(){}, setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},
  addEventListener(){}, innerWidth:1000,innerHeight:600,devicePixelRatio:1,
  matchMedia:()=>({matches:false,addEventListener(){}}),
  getComputedStyle:()=>({getPropertyValue:()=>''}), location:{href:'https://example.test',pathname:'/'},
  fetch:async()=>({ok:true,json:async()=>[],text:async()=>''}), URL, URLSearchParams, Date, Math,
  alert(){}, confirm:()=>false
};
context.window=context;
vm.createContext(context);
for (const [i,script] of scripts.entries()) new vm.Script(script,{filename:`inline-${i}.js`}).runInContext(context);
const g=context;
let checks=0;
function test(name, f){f();checks++;console.log('OK',name);}
function state(day=1){g.S=g.nouvelEtat();g.S.enCours=true;g.S.jour=day;g.S.temps=(day-1)*g.CFG.SEC_PAR_JOUR;return g.S;}
// Keep rendering and persistence real; only suppress audiovisual effects.
for(const k of ['ouvrirLaMusiqueDeFete','fermerLaMusiqueDeFete','fanfare','parler','couperLaParole','sonBouton','flash','musique'])g[k]=()=>{};
test('The whole game boots and the 18-level roadmap renders',()=>{
  assert.equal(g.ETAPES.length,18);assert.equal((nodes.get('parcoursListe').innerHTML.match(/<li /g)||[]).length,18);
  assert.equal(g.NIV().cle,'facile');
});
test('Each level requires ten full days; transitions neither skip nor repeat',()=>{
  state();
  for(let n=1;n<=18;n++){
    g.S.jour=n*10;g.S.temps=(g.S.jour-1)*13;
    assert.equal(g.peutFeter(),false,`premature level ${n}`);
    g.S.jour++;g.S.temps+=13;
    assert.equal(g.peutFeter(),true,`missing level ${n}`);
    g.lancerLaFete();
    assert.equal(g.S.etapesTerminees,n);
    assert.equal(g.S.chapitre.niveau,n);
    assert.ok(nodes.get('chapitre').innerHTML.includes(`NIVEAU ${n} / 18 TERMINÉ`));
    assert.equal(g.peutFeter(),false);
    g.fermerLeChapitre(true);
    assert.equal(g.peutFeter(),false);
  }
  assert.equal(g.S.fetes,6);
  assert.equal(g.numeroEtape(181),19);assert.equal(g.numeroEtape(900),19);
  g.S.jour=900;assert.equal(g.peutFeter(),false);
  assert.ok(nodes.get('chapitre').innerHTML==='');
});
test('An absent Dame does not desynchronize levels, promotions or events',()=>{
  state(31);g.S.etapesTerminees=2;g.S.parties[0]=true;
  assert.equal(g.peutFeter(),true);g.lancerLaFete();
  assert.equal(g.S.etapesTerminees,3);assert.equal(g.S.fetes,0);
  assert.equal(g.statutActuel().nom,'Maçon');
  assert.equal(g.lireProgres().niveau,19); // Existing higher progress is not lost.
});
test('Legacy progress preserves the furthest reached day and purchases',()=>{
  let p=g.normaliserProgres({partie:2,jours:95,ane:true,moto:false,toit:true});
  assert.equal(p.niveau,10);assert.equal(p.ane,true);assert.equal(p.toit,true);
  p=g.normaliserProgres({partie:3,jours:60});assert.equal(p.niveau,7);
  p=g.normaliserProgres({partie:10,jours:350,moto:true});assert.equal(p.niveau,19);
  state();g.appliquerLaProgression(p);assert.equal(g.S.jour,341);assert.equal(g.S.moto,true);
});
test('Restarting each checkpoint restores its available features',()=>{
  for(let n=1;n<=19;n++){
    state();g.appliquerLaProgression({schema:2,niveau:n,jours:(n-1)*10+1,ane:false,moto:false,toit:false});
    assert.equal(g.S.jour,(n-1)*10+1);
    assert.equal(g.S.filsParti,n>=8);assert.equal(g.S.aneOffert,n>=7);
    assert.equal(g.S.saisonPluies,n>=10);assert.equal(g.S.motoOfferte,n>=13);
    assert.equal(g.S.vacances,n===12);
    assert.equal(g.peutFeter(),false);
  }
});
test('Saving during a level transition resumes without an invisible chapter',()=>{
  state(11);g.lancerLaFete();g.sauvegarder();
  const saved=JSON.parse(data.get(g.CLE_PARTIE));
  assert.equal(saved.chapitre,null);assert.equal(saved.etapesTerminees,1);
  g.S=g.migrerSauvegarde(saved);assert.equal(g.peutFeter(),false);
});
test('Legacy active saves retain their day, money, inventory and difficulty',()=>{
  data.delete('lqd_niveau');
  const old={jour:120,temps:1547,argent:432,ane:true,chapitre:{niveau:4},fetes:2};
  const saved=g.migrerSauvegarde(old);
  assert.equal(saved.jour,120);assert.equal(saved.temps,1547);assert.equal(saved.argent,432);
  assert.equal(saved.ane,true);assert.equal(saved.chapitre,null);assert.equal(saved.etapesTerminees,11);
  assert.equal(saved.difficulte,'dur');
  data.set('lqd_niveau','tresdur');assert.equal(g.migrerSauvegarde({jour:8}).difficulte,'tresdur');
});
test('The learning ramp rises smoothly and ends at the original difficulty',()=>{
  assert.equal(g.douceurDepart(1),.65);
  for(let day=2;day<=31;day++)assert.ok(g.douceurDepart(day)>g.douceurDepart(day-1));
  assert.equal(g.douceurDepart(31),1);assert.equal(g.douceurDepart(900),1);
});
test('Progress is separate for each difficulty',()=>{
  data.clear();g.iNiveau=0;state(51);g.ecrireProgres();assert.equal(g.lireProgres().niveau,6);
  g.iNiveau=1;assert.equal(g.lireProgres(),null);state(21);g.ecrireProgres();
  assert.equal(g.lireProgres().niveau,3);g.iNiveau=0;assert.equal(g.lireProgres().niveau,6);
});
test('Objective, advice and completed days correspond to the current level',()=>{
  state(78);g.afficherEtape();
  assert.ok(nodes.get('etapeTitre').textContent.includes('Niveau 8 / 18'));
  assert.ok(nodes.get('etapeObjectif').textContent.includes('jour 80'));
  assert.equal(nodes.get('etapeAvance').value,7);
  state(181);g.afficherEtape();assert.ok(nodes.get('etapeTitre').textContent.includes('Survie libre'));
});
console.log(`${checks} progression tests passed; all ${scripts.length} inline scripts parsed and initialized.`);
test('The actual game loop introduces features at the announced levels',()=>{
  data.clear();g.iNiveau=0;g.demarrer();g.gamePaused=false;
  for(let day=2;day<=181;day++){
    if(g.S.chapitre)g.fermerLeChapitre(true);
    g.S.temps=(day-1)*g.CFG.SEC_PAR_JOUR;
    g.S.force=100;g.S.jauges=[90,90,90,90];g.S.argent=100000;g.S.attente=0;
    g.last=1000;g.tourDeBoucle(1000);
    if(day===31)assert.ok(g.S.enfant);
    if(day===61){assert.equal(g.S.aneOffert,true);assert.ok(g.S.enfant);}
    if(day===71){assert.equal(g.S.filsParti,true);assert.equal(g.S.enfant,null);}
    if(day===78)assert.equal(g.S.mandatsEnvoyes,1);
    if(day===91)assert.equal(g.S.saisonPluies,true);
    if(day===92)assert.equal(g.S.toitPropose,true);
    if(day===111){assert.equal(g.S.vacances,true);assert.ok(g.S.enfant);}
    if(day===118){assert.equal(g.S.vacances,false);assert.equal(g.S.enfant,null);}
    if(day===121)assert.equal(g.S.motoOfferte,true);
    if(day===151)assert.equal(g.estConge(day),true);
    // A new day is processed before the transition is presented on the next frame.
    g.tourDeBoucle(1000);
  }
  assert.equal(g.S.etapesTerminees,18);
  assert.ok(nodes.get('chapitre').innerHTML.includes('Continuer en survie libre'));
});
console.log(`TOTAL: ${checks} tests passed.`);
test('Every Dame grants only her own benefit while she is at the foyer',()=>{
  state();
  assert.equal(g.soutienSante(),1.2);assert.equal(g.soutienAmour(),.85);
  assert.equal(g.soutienSpiritualite(0),.9);assert.equal(g.soutienSpiritualite(2),1);
  assert.equal(g.soutienArgent(),.9);
  g.S.parties[0]=true;assert.equal(g.soutienSante(),1);assert.equal(g.soutienAmour(),.85);
  g.S.parties[1]=true;assert.equal(g.soutienAmour(),1);
  g.S.parties[2]=true;assert.equal(g.soutienSpiritualite(0),1);
  g.S.parties[3]=true;assert.equal(g.soutienArgent(),1);
  g.S.parties=[false,false,false,false];g.S.exode[0]={retour:true,rachat:true};assert.equal(g.soutienSante(),1);
});
test('Benefits affect actual recovery, walking fatigue and shopping prices',()=>{
  g.demarrer();g.S.force=40;g.S.modou.x=g.CENTRE.x;g.S.modou.y=g.CENTRE.y;
  g.vivreDansLaZone(.1);const withHealth=g.S.force-40;
  g.S.parties[0]=true;g.S.force=40;g.vivreDansLaZone(.1);const withoutHealth=g.S.force-40;
  assert.ok(Math.abs(withHealth/withoutHealth-1.2)<1e-9);
  g.S.zone=null;g.S.force=100;g.S.modou.x=50;g.S.modou.y=51.9;g.JOY.dx=1;g.JOY.dy=0;
  g.deplacerModou(.05);const withLove=100-g.S.force;
  g.S.parties[1]=true;g.S.force=100;g.S.modou.x=50;g.S.modou.y=51.9;
  g.deplacerModou(.05);const withoutLove=100-g.S.force;
  assert.ok(withLove>0);assert.ok(Math.abs(withLove/withoutLove-.85)<1e-9);g.joyFin();
  const discounted=g.prixDuJour('AMOUR');g.S.parties[3]=true;
  assert.equal(discounted,36);assert.equal(g.prixDuJour('AMOUR'),40);
});
test('Recall costs at least half the exact balance, rounded up, with a 100 F minimum',()=>{
  state();
  for(const [balance,cost] of [[0,100],[99,100],[100,100],[150,100],[800,400],[1001,501],[2000,1000],[200.5,101]]){
    g.S.argent=balance;assert.equal(g.prixRappel(),cost);
  }
  g.S.argent=1000;g.S.parties[3]=false;assert.equal(g.prixRappel(),500); // No shopping discount on recall.
});
function departed(indices,balance=1000){
  g.demarrer();g.gamePaused=false;g.S.argent=balance;
  for(const i of indices){g.S.parties[i]=true;g.S.jauges[i]=0;g.S.ordreDepart.push(i);g.fermerLeFoyer(i);}
  g.S.sorties=indices.length;return g.S;
}
test('Having money never triggers an automatic return',()=>{
  departed([3],100000);g.last=1000;
  for(let t=1000;t<1250;t+=50)g.tourDeBoucle(t);
  assert.equal(g.S.parties[3],true);assert.equal(g.S.rachats,0);assert.equal(g.S.exode[3],null);
});
test('Canceling a quote freezes the game and does not spend or recall',()=>{
  departed([0]);const before=JSON.stringify(g.S);
  let prompted=false;g.confirm=message=>{
    prompted=true;assert.equal(g.gamePaused,true);assert.ok(message.includes('500 F'));
    const time=g.S.temps;g.tourDeBoucle(9999);assert.equal(g.S.temps,time);return false;
  };
  assert.equal(g.demanderRappel(0),false);assert.equal(prompted,true);
  assert.equal(JSON.stringify(g.S),before);assert.equal(g.gamePaused,false);
});
test('Insufficient money disables recall and never prompts or charges',()=>{
  departed([3],99);g.majRappels();assert.equal(nodes.get('rappelDame3').disabled,true);
  g.confirm=()=>{throw Error('Should not prompt');};assert.equal(g.demanderRappel(3),false);
  assert.equal(g.S.argent,99);assert.equal(g.S.parties[3],true);
});
test('The selected Dame returns once; other absent Dames stay away',()=>{
  departed([0,3]);g.confirm=()=>true;
  assert.equal(g.demanderRappel(3),true);assert.equal(g.S.argent,500);assert.equal(g.S.parties[0],true);
  assert.equal(g.S.parties[3],false);assert.equal(g.S.exode[3].rachat,true);assert.equal(g.S.rachats,1);
  assert.equal(g.demanderRappel(3),false);assert.equal(g.S.argent,500);
  assert.equal(g.soutienArgent(),1); // Returning is not the same as arrived.
  const saved=JSON.parse(data.get(g.CLE_PARTIE));
  assert.equal(saved.argent,500);assert.equal(saved.exode[3].rachat,true);
  g.S=g.migrerSauvegarde(saved);assert.equal(g.soutienArgent(),1);
  for(let i=0;i<2000 && g.S.exode[3];i++)g.majExode(.1);
  assert.equal(g.S.exode[3],null);assert.equal(g.soutienArgent(),.9);assert.equal(g.S.argent,500);
});
test('Quotes are checked again before debit and restore an existing pause',()=>{
  departed([1]);assert.equal(g.faireRevenir(1,499),false);assert.equal(g.S.argent,1000);
  g.gamePaused=true;g.confirm=()=>true;assert.equal(g.demanderRappel(1),true);assert.equal(g.gamePaused,true);
});
test('The main menu has only New and Resume as game actions',()=>{
  const actions=html.match(/<div id="actionsPartie">([\s\S]*?)<\/div>/)[1];
  assert.equal((actions.match(/<button /g)||[]).length,2);
  assert.ok(actions.includes('Nouvelle partie'));assert.ok(actions.includes('Reprendre'));
  assert.ok(!html.includes('id="btnProgres"'));assert.ok(!html.includes('id="btnZero"'));
});
test('Resume is available from day one and restores the exact game and difficulty',()=>{
  data.clear();g.majBoutonReprendre();assert.equal(nodes.get('btnReprendre').disabled,true);
  g.iNiveau=2;g.demarrer();assert.ok(g.partieEnAttente());
  assert.equal(nodes.get('btnReprendre').disabled,false);
  assert.ok(nodes.get('btnReprendre').innerHTML.includes('jour 1'));
  g.S.jour=24;g.S.temps=300;g.S.argent=321.5;g.S.force=63;g.S.modou.x=60;g.S.modou.y=51.9;
  g.sauvegarder();g.iNiveau=0;g.reprendreLaPartie();
  assert.equal(g.S.jour,24);assert.equal(g.S.temps,300);assert.equal(g.S.argent,321.5);
  assert.equal(g.S.force,63);assert.equal(g.S.modou.x,60);assert.equal(g.NIV().cle,'tresdur');
  assert.equal(g.gamePaused,true);
});
test('New game preserves the save until a difficulty starts it without a prompt',()=>{
  const saved=data.get(g.CLE_PARTIE);
  g.confirm=()=>{throw Error('Starting a new game must not prompt');};
  g.traiterAppui({cancelable:false}, {id:'btnStart'});
  assert.equal(nodes.get('scrDifficulte').classList.contains('hide'),false);
  assert.equal(data.get(g.CLE_PARTIE),saved);
  g.traiterAppui({cancelable:false},{id:'difficulteRetour'});
  assert.equal(nodes.get('scrDifficulte').classList.contains('hide'),true);
  assert.equal(data.get(g.CLE_PARTIE),saved);
  g.traiterAppui({cancelable:false},{id:'btnStart'});
  g.traiterAppui({cancelable:false},{id:'niv1'});
  assert.equal(g.S.jour,1);assert.equal(g.S.etapesTerminees,0);assert.equal(g.partieEnAttente().jour,1);
  assert.equal(g.S.difficulte,'dur');assert.equal(nodes.get('scrDifficulte').classList.contains('hide'),true);
});
console.log(`TOTAL: ${checks} regression tests passed.`);
