type Media=Record<string,string>;
type Step={id:number;kicker:string;title:string;text:string;image?:string};

const DEFAULTS:Step[]=[
  {id:1,kicker:'01 · ACTIVEZ',title:'Associez vos tablettes',text:'Activez une station CAPTURE et une station SHARING avec le code KHE de votre événement.'},
  {id:2,kicker:'02 · PERSONNALISEZ',title:'Préparez votre design',text:'Dans Studio, choisissez votre identité, vos textes, vos cadres et votre ambiance visuelle.'},
  {id:3,kicker:'03 · CAPTUREZ',title:'Lancez l’expérience',text:'CAPTURE se concentre sur la photo ou la vidéo pendant que SHARING reste disponible pour les invités.'},
  {id:4,kicker:'04 · PARTAGEZ',title:'Remettez le souvenir',text:'Galerie, QR sécurisé et cloud transforment la prise de vue en souvenir immédiatement exploitable.'},
];

export function HowItWorksShowcase({media}:{media?:Media}){
  const steps=DEFAULTS.map((step)=>({...step,title:media?.[`how${step.id}Title`]||step.title,text:media?.[`how${step.id}Text`]||step.text,image:media?.[`how${step.id}ImageUrl`]||undefined}));
  return <section className="marketing-section how-showcase" id="mode-emploi">
    <div className="section-heading centered"><div className="marketing-kicker"><span/> MODE D’EMPLOI VISUEL</div><h2>Comprendre KHE Booth en quelques secondes.</h2><p>Une démonstration visuelle simple pour montrer au futur client ce qu’il pourra réellement faire avec l’application.</p></div>
    <div className="how-grid">{steps.map((step)=><article className="how-card" key={step.id}><div className="how-visual">{step.image?<img src={step.image} alt=""/>:<BuiltInStep id={step.id}/>}<div className="how-step-number">0{step.id}</div></div><div className="how-copy"><div className="eyebrow">{step.kicker}</div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div>
  </section>;
}

function BuiltInStep({id}:{id:number}){
  if(id===1)return <div className="how-built how-pair"><div className="how-device"><b>CAPTURE</b><span>●</span></div><div className="how-pair-line">✦</div><div className="how-device"><b>SHARING</b><span>▦</span></div></div>;
  if(id===2)return <div className="how-built how-studio"><div className="how-canvas"><span>KHE EVENT</span><strong>Votre design</strong></div><div className="how-tools"><i>T</i><i>✦</i><i>◫</i></div></div>;
  if(id===3)return <div className="how-built how-capture"><div className="how-camera"><div className="how-camera-ring"><i/></div><b>3</b></div><div className="how-capture-caption">Interface masquée automatiquement</div></div>;
  return <div className="how-built how-share"><div className="how-phone-small"><span>▦</span><b>Souvenir prêt</b></div><div className="how-share-bubbles"><i>↗</i><i>☁</i><i>✓</i></div></div>;
}
