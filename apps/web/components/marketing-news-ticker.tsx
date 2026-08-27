type NewsItem={label:string;href?:string};

export function MarketingNewsTicker({items,ariaLabel}:{items:NewsItem[];ariaLabel:string}){
  const visible=items.filter((item)=>item.label.trim()).slice(0,8);
  if(!visible.length)return null;
  const group=(suffix:string)=><div className="marketing-news-track-group" aria-hidden={suffix==='copy'}>{visible.map((item,index)=>item.href?<a key={`${suffix}-${index}`} href={item.href}><i/> {item.label}</a>:<span key={`${suffix}-${index}`}><i/> {item.label}</span>)}</div>;
  return <section className="marketing-news-ticker" aria-label={ariaLabel}><div className="marketing-news-live"><span/>KHE LIVE</div><div className="marketing-news-viewport"><div className="marketing-news-track">{group('main')}{group('copy')}</div></div></section>;
}
