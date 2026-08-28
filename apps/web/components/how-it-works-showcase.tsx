import { getMarketingCopy, type MarketingLanguage } from '@/lib/marketing-i18n';

type Media=Record<string,string>;

export function HowItWorksShowcase({media,language}:{media?:Media;language:MarketingLanguage}){
  const t=getMarketingCopy(language).how;
  const steps=t.steps.map((step,index)=>({id:index+1,kicker:step.kicker,title:media?.[`how${index+1}Title`]||step.title,text:media?.[`how${index+1}Text`]||step.text,image:media?.[`how${index+1}ImageUrl`]||undefined}));
  return <section className="marketing-section how-showcase" id="mode-emploi">
    <div className="section-heading centered"><div className="marketing-kicker"><span/> {t.kicker}</div><h2>{t.title}</h2><p>{t.intro}</p></div>
    <div className="how-grid">{steps.map((step)=><article className="how-card" key={step.id}><div className="how-visual">{step.image?<img src={step.image} alt=""/>:<BuiltInStep id={step.id} copy={t}/>}<div className="how-step-number">0{step.id}</div></div><div className="how-copy"><div className="eyebrow">{step.kicker}</div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div>
  </section>;
}

function BuiltInStep({id,copy}:{id:number;copy:ReturnType<typeof getMarketingCopy>['how']}){
  if(id===1)return <div className="how-built how-pair"><div className="how-device"><b>CAPTURE</b><span>●</span></div><div className="how-pair-line">✦</div><div className="how-device"><b>SHARING</b><span>▦</span></div></div>;
  if(id===2)return <div className="how-built how-studio"><div className="how-canvas"><span>KHE EVENT</span><strong>{copy.design}</strong></div><div className="how-tools"><i>T</i><i>✦</i><i>◫</i></div></div>;
  if(id===3)return <div className="how-built how-capture"><div className="how-camera"><div className="how-camera-ring"><i/></div><b>3</b></div><div className="how-capture-caption">{copy.hidden}</div></div>;
  return <div className="how-built how-share"><div className="how-phone-small"><span>▦</span><b>{copy.ready}</b></div><div className="how-share-bubbles"><i>↗</i><i>☁</i><i>✓</i></div></div>;
}
