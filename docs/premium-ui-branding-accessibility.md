# KHE Booth — Premium UI, Branding & Accessibility

Tracking issue: #39

## Scope

This lot starts from the validated state of PR #38 and focuses exclusively on presentation, comfort and interaction quality. It must not regress station activation, SHARING/CAPTURE approval, offline media sync, Studio synchronization, profile synchronization or Blob storage.

## Architecture decisions

### 1. CAPTURE immersive chrome
- Keep the current `Animated.Value`-based fade in `CameraCapture`.
- Countdown entry must trigger automatic chrome fade-out.
- Camera, countdown and active Studio design stay visible.
- Controls return after completion, cancellation or error.
- A dedicated camera tap layer remains separate from actionable controls.

### 2. Connection experience
Create a reusable mobile `CaptureConnectionExperience` component with an explicit state machine:

`DISCONNECTED -> SEARCHING -> REQUESTED -> WAITING_APPROVAL -> CONNECTED | REFUSED | ERROR`

Visual system:
- sky blue background/accent;
- metallic gold star/progress;
- white secondary surfaces;
- real progress driven by state transitions;
- success particle burst / gold firework animation after `CONNECTED`.

The star animation must always complete visually when the state reaches `CONNECTED`; no indeterminate half-progress state is allowed.

### 3. Typography accessibility
Create a shared display preference model:

```ts
type TextScale = 'SMALL' | 'NORMAL' | 'LARGE' | 'XLARGE';
type TextStyle = 'CLASSIC' | 'MODERN' | 'ELEGANT' | 'COMFORT';
```

Mobile:
- persist locally in SecureStore;
- expose from Settings;
- provide live preview;
- apply through shared typography helpers/tokens, not isolated hard-coded replacements.

Web:
- expose the same four size and style choices;
- persist preference locally and use CSS variables/tokens;
- preserve responsive layout at XLARGE.

### 4. Startup intro
Implement a short non-blocking startup sequence.

Sequence proposal:
1. black/charcoal stage;
2. K, H, E reveal one letter at a time with gold light sweep;
3. full KHE mark reveal;
4. stylized 360 booth and kiosk booth silhouettes enter from opposite sides;
5. `KHE BOOTH` appears;
6. slogan appears;
7. short product description appears;
8. transition into the application.

Requirements:
- total target duration 2.5–4.5 seconds;
- skip becomes available after a short minimum delay;
- no network dependency;
- static fallback when animation cannot run;
- same brand language on web KHE BOOTH launch/landing experience.

### 5. Password fields
Create reusable password field components for mobile and web.

Default:
- actual input is secure;
- one visible bullet/star per entered character;
- eye action toggles clear text;
- toggling back restores secure display;
- passwords never enter logs, analytics or plain persistence.

### 6. Design tokens
Introduce shared semantic tokens where practical:
- `kheGold`
- `kheSky`
- `kheRed`
- `kheBlack`
- `surfaceLight`
- `textPrimary`
- animation durations/easings
- typography scale/style mapping

## Acceptance checklist

### CAPTURE
- [ ] Countdown automatically fades functional UI out.
- [ ] Manual tap hide/show still works.
- [ ] Pressing a control never triggers the camera tap gesture.
- [ ] Studio design remains visible during countdown/capture.
- [ ] UI is restored on success, cancel and error.

### SHARING connection
- [ ] Sky blue + gold connection UI replaces black/white treatment.
- [ ] Gold star/progress reaches completion.
- [ ] Waiting for CAPTURE approval has a distinct state.
- [ ] Connected state triggers celebratory gold particle/firework animation.
- [ ] Controls remain locked before explicit CAPTURE approval.

### Accessibility
- [ ] Four font sizes available.
- [ ] Four text styles available.
- [ ] Live preview in Settings.
- [ ] Preference persists across restart.
- [ ] XLARGE remains usable in portrait and landscape.

### Startup
- [ ] Animated K/H/E reveal.
- [ ] KHE Booth brand reveal.
- [ ] 360 photobooth visual.
- [ ] kiosk/born photobooth visual.
- [ ] slogan and product description.
- [ ] skip and fallback behavior.

### Passwords
- [ ] Secure markers visible while typing.
- [ ] Eye toggles plain/secure text.
- [ ] Mobile and web share the same behavior.

## Validation gates
- Mobile typecheck
- Mobile offline tests
- Mobile TypeScript build
- Repository lint
- API/web tests
- Full build
- Android portrait/landscape manual validation
- Web responsive validation
