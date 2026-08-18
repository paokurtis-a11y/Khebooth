'use client';

import { useEffect, useState } from 'react';

export function WebStartupIntro() {
  const [visible, setVisible] = useState(true);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const skip = window.setTimeout(() => setCanSkip(true), 900);
    const done = window.setTimeout(() => setVisible(false), 4200);
    return () => { window.clearTimeout(skip); window.clearTimeout(done); };
  }, []);

  if (!visible) return null;

  return (
    <div className="khe-startup" role="presentation">
      <div className="sky-glow" /><div className="gold-glow" />
      <div className="intro-stage">
        <div className="letters"><span>K</span><span>H</span><span>E</span></div>
        <div className="booth-title">KHE BOOTH</div>
        <div className="booths">
          <div className="booth booth-360"><div className="ring"><div className="phone">360°</div></div><strong>PHOTOBOOTH 360</strong></div>
          <div className="booth kiosk"><div className="kiosk-head"><i /></div><div className="kiosk-body">KHE</div><div className="kiosk-stand" /><strong>BORNE PHOTOBOOTH</strong></div>
        </div>
        <div className="copy"><h2>Votre événement, notre expertise</h2><p>Capturez, créez et partagez vos souvenirs avec une régie photobooth pensée pour vos événements.</p></div>
      </div>
      {canSkip ? <button type="button" className="skip" onClick={() => setVisible(false)}>PASSER</button> : null}
      <style jsx>{`
        .khe-startup{position:fixed;inset:0;z-index:99999;background:#101114;color:white;display:grid;place-items:center;overflow:hidden;animation:introOut .45s ease 3.75s forwards}
        .intro-stage{position:relative;z-index:2;width:min(760px,92vw);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
        .letters{display:flex;gap:3px;font-size:clamp(62px,10vw,92px);font-weight:950;line-height:.9;color:#d7b24c;text-shadow:0 0 24px rgba(255,231,145,.38)}
        .letters span{display:inline-block;opacity:0;transform:translateY(28px) scale(.75);animation:letterIn .42s cubic-bezier(.22,.9,.32,1.35) forwards}.letters span:nth-child(2){animation-delay:.32s}.letters span:nth-child(3){animation-delay:.64s}
        .booth-title{font-size:clamp(20px,4vw,31px);font-weight:950;letter-spacing:.35em;opacity:0;animation:fadeUp .48s ease 1s forwards}
        .booths{display:flex;gap:42px;align-items:end;justify-content:center;flex-wrap:wrap;margin-top:14px}.booth{width:170px;display:flex;flex-direction:column;align-items:center;gap:9px;opacity:0}.booth strong{font-size:10px;letter-spacing:.16em;color:#d9dde3}.booth-360{animation:leftIn .58s cubic-bezier(.2,.9,.3,1.2) 1.2s forwards}.kiosk{animation:rightIn .58s cubic-bezier(.2,.9,.3,1.2) 1.2s forwards}
        .ring{width:140px;height:78px;border:5px solid #d7b24c;border-radius:50%;display:grid;place-items:center;transform:perspective(220px) rotateX(57deg)}.phone{width:40px;height:70px;border:2px solid #8ad9f5;background:#17181d;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:900;transform:rotateX(-57deg)}
        .kiosk-head{width:92px;height:35px;border-radius:28px 28px 0 0;background:#d7b24c;display:grid;place-items:center}.kiosk-head i{width:13px;height:13px;border-radius:50%;background:#17181d;border:2px solid #8ad9f5}.kiosk-body{width:100px;height:82px;border:3px solid #d7b24c;border-radius:14px;background:#26282d;color:#8ad9f5;display:grid;place-items:center;font-weight:950;letter-spacing:.15em}.kiosk-stand{width:24px;height:35px;background:#d7b24c;border-radius:0 0 5px 5px}
        .copy{max-width:570px;opacity:0;animation:fadeUp .5s ease 1.72s forwards}.copy h2{margin:12px 0 5px;color:#d7b24c;font-size:clamp(18px,3vw,25px)}.copy p{margin:0;color:#d9dde3;line-height:1.55;font-size:13px}
        .skip{position:absolute;right:22px;bottom:22px;z-index:4;border:1px solid rgba(255,255,255,.35);background:rgba(16,17,20,.5);color:white;border-radius:999px;padding:10px 15px;font-size:10px;font-weight:900;letter-spacing:.12em;cursor:pointer}
        .sky-glow,.gold-glow{position:absolute;border-radius:50%;filter:blur(2px)}.sky-glow{width:440px;height:440px;right:-130px;top:-130px;background:rgba(138,217,245,.17)}.gold-glow{width:390px;height:390px;left:-130px;bottom:-140px;background:rgba(215,178,76,.14)}
        @keyframes letterIn{to{opacity:1;transform:none}}@keyframes fadeUp{to{opacity:1;transform:translateY(0)}}@keyframes leftIn{from{transform:translateX(-70px) scale(.78)}to{opacity:1;transform:none}}@keyframes rightIn{from{transform:translateX(70px) scale(.78)}to{opacity:1;transform:none}}@keyframes introOut{to{opacity:0;visibility:hidden;pointer-events:none}}
        @media (prefers-reduced-motion:reduce){.khe-startup *{animation-duration:.01ms!important;animation-delay:0ms!important}.khe-startup{animation:none}.letters span,.booth-title,.booth,.copy{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}
