'use client';

type Media=Record<string,string>;

export function SiteVisualEditor({media,onChange}:{media:Media;onChange:(media:Media)=>void}){
  const patch=(key:string,value:string)=>onChange({...media,[key]:value});
  return <div className="site-visual-editor">
    <section className="site-visual-admin-section">
      <div><div className="eyebrow">4 SÉQUENCES PROMOTIONNELLES</div><h2>Vidéos et histoires visuelles</h2><p className="muted">Chaque séquence possède une animation KHE intégrée par défaut. Collez plus tard une URL MP4/WebM pour remplacer l’animation par votre propre vidéo, ainsi qu’une affiche si vous le souhaitez.</p></div>
      <div className="site-visual-admin-grid">{[1,2,3,4].map((id)=><article className="site-visual-admin-card" key={id}><div className="site-visual-admin-head"><span>0{id}</span><strong>Séquence promotionnelle {id}</strong></div><label>Titre<input value={media[`promo${id}Title`]||''} placeholder={promoDefaults[id-1].title} onChange={(event)=>patch(`promo${id}Title`,event.target.value)}/></label><label>Sous-titre<textarea rows={3} value={media[`promo${id}Subtitle`]||''} placeholder={promoDefaults[id-1].subtitle} onChange={(event)=>patch(`promo${id}Subtitle`,event.target.value)}/></label><label>URL vidéo MP4 / WebM<input value={media[`promo${id}Url`]||''} placeholder="Laisser vide = animation KHE intégrée" onChange={(event)=>patch(`promo${id}Url`,event.target.value)}/></label><label>URL de l’affiche vidéo<input value={media[`promo${id}PosterUrl`]||''} placeholder="https://…/affiche.jpg" onChange={(event)=>patch(`promo${id}PosterUrl`,event.target.value)}/></label></article>)}</div>
    </section>

    <section className="site-visual-admin-section">
      <div><div className="eyebrow">MODE D’EMPLOI VISUEL</div><h2>Images qui expliquent l’application</h2><p className="muted">Ces quatre cartes expliquent le parcours : associer, personnaliser, capturer, partager. Si aucune image n’est fournie, KHE affiche une illustration animée intégrée.</p></div>
      <div className="site-visual-admin-grid">{[1,2,3,4].map((id)=><article className="site-visual-admin-card" key={id}><div className="site-visual-admin-head"><span>0{id}</span><strong>Étape {id}</strong></div><label>Titre<input value={media[`how${id}Title`]||''} placeholder={howDefaults[id-1].title} onChange={(event)=>patch(`how${id}Title`,event.target.value)}/></label><label>Explication<textarea rows={3} value={media[`how${id}Text`]||''} placeholder={howDefaults[id-1].text} onChange={(event)=>patch(`how${id}Text`,event.target.value)}/></label><label>URL image<input value={media[`how${id}ImageUrl`]||''} placeholder="Laisser vide = illustration KHE intégrée" onChange={(event)=>patch(`how${id}ImageUrl`,event.target.value)}/></label></article>)}</div>
    </section>
  </div>;
}

const promoDefaults=[
  {title:'Un événement. Deux stations. Zéro friction.',subtitle:'CAPTURE filme. SHARING distribue. KHE garde les deux expériences synchronisées.'},
  {title:'Votre univers visuel prend vie.',subtitle:'Cadres, textes, couleurs et identité événementielle sont préparés dans Studio.'},
  {title:'Le souvenir arrive dans les mains de l’invité.',subtitle:'QR sécurisé, galerie cloud et partage rapide : moins d’attente, plus d’émotion.'},
  {title:'Pilotez l’événement comme une régie.',subtitle:'Clients, abonnements, statistiques et opérations réunis dans KHE Booth.'},
];
const howDefaults=[
  {title:'Associez vos tablettes',text:'Activez CAPTURE et SHARING avec le code KHE de votre événement.'},
  {title:'Préparez votre design',text:'Choisissez vos textes, cadres, couleurs et identité dans Studio.'},
  {title:'Lancez l’expérience',text:'CAPTURE se concentre sur la prise de vue pendant que SHARING reste disponible.'},
  {title:'Remettez le souvenir',text:'Galerie, QR et cloud transforment la capture en souvenir immédiatement partageable.'},
];
