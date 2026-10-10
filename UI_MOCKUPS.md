# PredictDx - UI Screen Mockups & Specifications

---

## SCREEN 1: LANDING PAGE - HERO SECTION

### Desktop Layout (1200px+)

```
┌──────────────────────────────────────────────────────────────────┐
│ PredictDx              [Home] [How] [Features] [Services] [Sign In]│
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  AI-Powered X-ray Analysis             [Chest X-Ray Image]       │
│  for Faster, Smarter Healthcare        [Professional Medical     │
│                                         Photo]                    │
│  Upload your X-ray, get AI insights,                             │
│  interact with doctors, and receive                              │
│  e-prescriptions — all in one place.                             │
│                                                                   │
│  [Get Started] [How it works]                                    │
│                                                                   │
│  ✓ Two-step sign-in  ✓ Pneumonia & TB Detection  ✓ 12-month Risk│
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Design Details

**Hero Section**
- **Background**: Clean white gradient to light blue (0° to 135°)
  - Start: `#FFFFFF`
  - End: `#F0F4FF`
- **Text Color**: `#0F172A` (dark navy)
- **Layout**: 50/50 split (text left, image right on desktop)
- **Image**: Professional medical X-ray photography (not stock AI art)
- **Typography**:
  - Headline: 52px, 700 weight, line-height 1.2
  - Subheadline: 20px, 400 weight, color `#475569`
- **CTAs**:
  - Primary button (Get Started): Blue `#0066CC`, white text
  - Secondary button (How it works): White bg, blue text, blue border
  - Both: 48px height, 24px horizontal padding

**Trust Badges**
- Row below CTA with 3 badges
- Icons: Shield (20px), Lungs (20px), Activity (20px)
- Text: Small, 12px, bold
- Icon + text in row, gap 6px
- Color: `#0052A3` (darker blue)

---

## SCREEN 2: AUTH SCREEN (SIGN IN)

### Desktop Layout

```
┌────────────────────────────────────────────────────────────┐
│                                                              │
│ PredictDx Brand                   │  Your health matters    │
│ Heading                           │  ───────────────────    │
│ Explain value prop                │  [Email Input Field]    │
│ - Quick diagnosis                 │  [Password Input Field] │
│ - Expert doctors                  │  □ Remember me          │
│ - Your health record              │  [Sign In Button]       │
│                                   │  Forgot password?       │
│ Join as patient                   │  ───────────────────    │
│ [Patient signup link]             │  No account?            │
│                                   │  Sign up here           │
│                                   │                         │
└────────────────────────────────────────────────────────────┘
```

### Components

**Email Input**
```
[📧 Email Address             ]
```
- Placeholder: `your@email.com`
- Icon on left (14px)
- Icon color: `#94A3B8`
- Padding: 14px left (+ icon), 14px right, 12px v
- Border: `1px solid #E2E8F0`
- Radius: 8px
- Focus: `2px solid #0066CC` + shadow `0 0 0 3px rgba(0,102,204,0.1)`

**Password Input**
```
[🔒 Password              👁️]
```
- Same as email, but with show/hide toggle
- Toggle icon: 16px, on right side
- Hover on toggle: Color change to `#0066CC`

**Sign In Button**
```
┌──────────────────────────────┐
│  Sign In to Your Account     │
└──────────────────────────────┘
```
- Width: 100%
- Height: 48px
- Font: 16px, 600 weight, white text
- Background: `#0066CC`
- Hover: `#0052A3` + shadow `0 4px 12px rgba(0,102,204,0.2)`
- Active: Scale 0.98
- Disabled: 60% opacity

**Forgot Password Link**
```
Forgot password? ← (clickable, blue, 14px)
```
- Color: `#0066CC`
- On hover: Underline + darker
- Micro-interaction: Click → slides right with subtle animation

**Divider**
```
────── OR ──────
```
- Line: `#E2E8F0`, 1px
- Text: `#94A3B8`, 12px, bold

**Sign Up Link**
```
No account? Sign up here →
```
- Color: `#0066CC`
- "here" is bold and clickable

---

## SCREEN 3: DIAGNOSIS CENTER (Main Workspace)

### Desktop Layout (3-Column)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏥 SMART DIAGNOSTIC CENTER                      [Last Updated: Now] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ QUEUE         │              VIEWER              │    ANALYSIS       │
│ (240px)       │            (Main, grow)          │    (320px)        │
│               │                                  │                   │
│ ┌───────────┐ │  ┌──────────────────────────────┐│  ┌──────────────┐ │
│ │[Thumb]    │ │  │                              ││  │ PRIMARY      │ │
│ │CODE-001   │ │  │      [Chest X-Ray Image]     ││  │ FINDING      │ │
│ │✓ Ready    │ │  │      with Heatmap Overlay    ││  │ ──────────── │ │
│ └───────────┘ │  │      and Measurement Grid    ││  │ Normal       │ │
│               │  │                              ││  │ 98%          │ │
│ ┌───────────┐ │  │                              ││  │ Confidence   │ │
│ │[Thumb]    │ │  │  [View Controls]─────────────│├─ │              │ │
│ │CODE-002   │ │  │  ☑ Heatmap  ☑ Boxes        ││  │ Class Prob:  │ │
│ │○ Pending  │ │  │  ☑ Grid  ☐ Invert          ││  │ ──────────── │ │
│ └───────────┘ │  │  Opacity: [####────] 70%    ││  │ Normal: 98%  │ │
│               │  │                              ││  │ Pneumonia: 2%│ │
│ [+ Upload]    │  │  PATIENT: Jane Doe          ││  │ TB: 0%       │ │
│               │  │  Acquired: Sep 26, 10:30 AM ││  │              │ │
│               │  │  Status: Analysed in 2.3s   ││  │ [Confirm →] │ │
│               │  └──────────────────────────────┘│  │              │ │
│               │                                  │  │ Risk Band:  │ │
│               │                                  │  │ ──────────── │ │
│               │                                  │  │ [Low ██░░░░░]│ │
│               │                                  │  │ 12-month risk│ │
│               │                                  │  │              │ │
│               │                                  │  │[Generate Rpt]│ │
│               │                                  │  │[Send to Radiology]
└───────────────┴──────────────────────────────────┴──┴──────────────┘
```

### Detailed Specifications

#### Left Sidebar: Studies Queue

**Header**
```
Studies Queue
━━━━━━━━━━━━━━
5 studies   (with count badge)
```
- Font: 14px, 600 weight
- Color: `#0F172A`
- Bottom border: `2px solid #E2E8F0`
- Padding: 16px

**Upload Zone** (if doctor)
```
┌───────────────────────────┐
│         📤 Upload         │
│   Drop chest X-ray here   │
│   PNG, JPG, DICOM · 20MB  │
│  [Browse files Button]    │
└───────────────────────────┘
```
- Border: `2px dashed #0284C7`
- Background: `#EFF6FF`
- Border-radius: 8px
- Padding: 16px
- Hover drag-over: 
  - Border solid + background fill `#E0EEFF`
  - Icon bigger animation (22px → 26px)

**Study Items**
```
┌─────────────────────────┐
│ [X-Ray Thumb] CODE-001  │
│ ✓                       │
│ Jane Doe · PA           │
└─────────────────────────┘
```

When **NOT selected**:
- Background: white
- Border: `1px solid #E2E8F0`
- Shadow: none
- Margin-bottom: 8px

When **SELECTED** (active):
- Background: `#F0F4FF` (light blue)
- Left border: `4px solid #0066CC` (blue highlight)
- Box shadow: `0 2px 8px rgba(0,102,204,0.12)`

**Components:**
- Thumbnail: 36x36px, border-radius 6px
- Study code: 10px, monospace, bold
- Patient name + view: 12px, secondary color
- Status badge (top-right):
  - Green checkmark for "Ready"
  - Orange alert for "Low confidence"
  - Blue spinner for "Analysing"

#### Center: X-Ray Viewer

**Header Bar**
```
├─ Heatmap ─ Lesion Boxes ─ Measurements Grid ─ Invert ─┤ Heat: 70% ▬ |
```
- Background: `#F8FAFC`
- Border-bottom: `1px solid #E2E8F0`
- Buttons: Toggle style (outline when off, filled when on)

**Viewer Canvas**
```
┌────────────────────────────────────┐
│                                    │
│    [Professional X-Ray Image]      │
│    With Heatmap Overlay            │
│    Radial gradient shows hot spots │
│    Red boxes mark detected regions │
│    Grid overlay for measurements   │
│                                    │
└────────────────────────────────────┘
```

**Canvas Details:**
- Background: `#000000` (black like film)
- Image container: full viewport
- Heatmap: Radial gradient
  - Center: Red-orange `rgba(255,58,36,0.95)`
  - Mid: Orange `rgba(255,146,0,0.55)`
  - Outer: Yellow `rgba(255,226,70,0.18)`
  - Edge: Transparent
- Lesion boxes:
  - Stroke: `2px solid #FF6B4A` (red-orange)
  - Label tag: Bold, white text on red bg
  - Hover: Expand slightly + highlight region

**Bottom Film Note**
```
CODE-001 · PA · chest-xray-2026-09-26.dcm
```
- Fixed bottom-left
- Small font: 12px, monospace
- Color: `#94A3B8` (muted)
- Background: `rgba(0,0,0,0.4)` (dark overlay)
- Padding: 8px 12px
- Border-radius: 4px

**Loading/Progress Overlay**
```
┌──────────────────────────┐
│ ANALYSING CODE-001       │
│ ▸ Loading model...  ✓    │
│ ▸ Preprocessing...  ✓    │
│ ▸ Running inference...   │
│ ▸ Post-processing...     │
│ ▸ Generating report...   │
│                          │
│ Progress: [█████░░░░░] 40%│
└──────────────────────────┘
```
- Overlay: `rgba(0,0,0,0.5)` with `backdrop-filter: blur(4px)`
- Card: 340px max width
- Steps: Green checkmark for done, blue play for current, gray dot for pending
- Progress bar: Animated smooth width change

#### Right Sidebar: Analysis Results

**Primary Finding Card**
```
┌──────────────────────────────┐
│ PRIMARY FINDING              │
│ ══════════════════════════    │
│ Normal                       │
│ 98% confidence               │
│ Above 70% gate ✓             │
└──────────────────────────────┘
```

**Color by Finding:**
- **Normal**: Green background `#ECFDF5`, green border `#10B981`
  - Text color: `#047857` (dark green)
- **Pneumonia**: Amber background `#FFFBEB`, border `#F59E0B`
  - Text color: `#B45309` (dark amber)
- **TB**: Red background `#FEF2F2`, border `#EF4444`
  - Text color: `#B91C1C` (dark red)

**Styling:**
- Padding: 16px
- Border-radius: 12px
- Border: `2px solid` (tone-specific)
- Title: 12px, bold, all-caps, muted
- Finding: 28px, 700 weight
- Confidence: 14px, secondary color

**Class Probabilities**
```
Class Probabilities
═══════════════════════════════
Normal              98% [████████████████] 98%
Pneumonia            2% [░░░░░░░░░░░░░░░░]  2%
Tuberculosis         0% [░░░░░░░░░░░░░░░░]  0%
```

**Details:**
- Label + percentage: 12px, bold on top line
- Bar: Full width, 6px height, gray background `#E2E8F0`
- Bar fill: Primary finding in dark color, others in `#0284C7`
- Spacing between: 8px

**Risk Band Card**
```
┌──────────────────────────────┐
│ 12-Month Risk                │
│ ══════════════════════════    │
│ Low Risk  ✓                  │
│ Score: 15/100                │
│ [████░░░░░░░░░░░░░░░░░░░░░] │
└──────────────────────────────┘
```

- Risk bands:
  - **Low** (0-33): Green `#10B981`
  - **Medium** (34-66): Amber `#F59E0B`
  - **High** (67-100): Red `#EF4444`
- Label: 14px, bold
- Score number: 20px, monospace
- Meter bar: Gradient matching risk level

**Doctor's Diagnosis Confirmation**
```
┌──────────────────────────────┐
│ Doctor's Confirmed Diagnosis │
│ ════════════════════════════  │
│                              │
│ [Normal] [Pneumonia] [TB] [Other]
│ ✓ Confirmed                  │
└──────────────────────────────┘
```

- Buttons: Pill-shaped, toggle style
- Active: Blue `#0066CC` bg with white text
- Inactive: Light gray outline
- Confirmed badge: Green chip with checkmark

**Action Buttons** (full-width at bottom)
```
[📄 Generate Diagnostic Report]
[📤 Send to Radiologist Review]
```

- Button 1: Primary blue (`#0066CC`)
- Button 2: Secondary (outline)
- Height: 48px
- Gap between: 8px
- Icons: 18px, left-aligned

---

## SCREEN 4: PATIENT DASHBOARD

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Welcome back, Jane!                    [Profile] [Settings]  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  [📊 Last Report]      [⏰ Next Appt]    [💬 Messages]       │
│   Sep 26 · Normal      Oct 3, 2:00 PM   3 unread             │
│   View →               Confirm →        Open →               │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Your Recent Records                                          │
│ ─────────────────────────────────                            │
│                                                               │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                      │
│  │[IMG] │  │[IMG] │  │[IMG] │  │[IMG] │                      │
│  │CODE1 │  │CODE2 │  │CODE3 │  │CODE4 │                      │
│  │Normal│  │Warn  │  │Normal│  │Normal│                      │
│  └──────┘  └──────┘  └──────┘  └──────┘                      │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Your Health Journey                                          │
│                                                               │
│ Sep 24: 📋 Report filed: Normal findings                     │
│ Sep 23: 📞 Follow-up call with Dr. Ahmed                     │
│ Sep 20: 💊 Prescription: Antibiotics                         │
│ Sep 18: 📊 X-ray analysis: Pneumonia detected                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Components

**Stat Cards** (3 across)
```
┌──────────────────┐
│  📊 Last Report  │
│  ══════════════  │
│  Sep 26          │
│  Normal findings │
│  [View Report →] │
└──────────────────┘
```

- Width: responsive 3-column
- Padding: 20px
- Border: `1px solid #E2E8F0`
- Border-radius: 12px
- Icon: 32px, centered at top
- Icon color: Tone-specific (green, blue, amber)
- CTA: Small link-button with arrow

**Records Grid**
```
┌─────────────────┐
│ [Thumbnail]     │
│ CODE-001        │
│ ✓ Normal        │
│ Sep 26, 10:30   │
└─────────────────┘
```

- Grid: 4 columns (responsive)
- Card: 140x160px
- Gap: 16px
- On hover: Scale 1.03 + shadow lift
- Click: Navigate to detail view
- Status indicator: Green/amber/red dot

**Timeline / Health Journey**
```
──●─ Sep 24: Report filed
  │  Normal findings
  │
  ●─ Sep 23: Follow-up call
  │  Dr. Ahmed
  │
  ●─ Sep 20: Prescription
    Antibiotics
```

- Timeline line: `2px solid #E2E8F0`
- Dots: 12px, colored by event type
- Event text: 14px, secondary color
- Date: 12px, bold, primary color
- Hover on item: Highlight with background

---

## SCREEN 5: DOCTOR WORKSPACE

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ Workspace                  [Filters] [Sort] [+ New Patient]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Patient Queue (12 patients)                                │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [Photo] Jane Doe · MRN: 123456    Status: 🟢 Stable  │ │
│ │ Age 34 · Last visit: 3 days ago · Allergies: Penicillin│ │
│ │ [View Records] [Prescribe] [Schedule Follow-up]          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [Photo] Ahmed Khan · MRN: 654321    Status: 🟡 Monitor │ │
│ │ Age 56 · Last visit: Today · Allergies: None           │ │
│ │ [View Records] [Prescribe] [Schedule Follow-up]        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ Quick Actions                                              │
│                                                             │
│ [📞 Call Patient] [📋 Create Note] [💊 E-Prescription]  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Patient Card Details

**Patient Card** (expanded/hover state)

```
┌──────────────────────────────────────────────────────────────┐
│  [Avatar]                                    Status: Stable  │
│  Jane Doe                                    ┌──────────────┐│
│  MRN: 123456                                 │ View Details │││
│  34 years old                                └──────────────┘│
│                                                              │
│  Last visit: 3 days ago                                     │
│  Allergies: Penicillin                                      │
│  Chronic conditions: Diabetes Type 2                         │
│                                                              │
│  Quick Actions:                                             │
│  [📋 View All Records] [💊 Prescribe] [⏰ Schedule Appt]  │
└──────────────────────────────────────────────────────────────┘
```

**Status Indicator**
- **Stable** (Green `#10B981`): ● Stable
- **Monitor** (Amber `#F59E0B`): ⚠ Monitor  
- **Urgent** (Red `#EF4444`): 🔴 Urgent

---

## SCREEN 6: CARECONNECT (MESSAGING)

### Layout

```
┌───────────────────────────────────────────────────────────┐
│ CareConnect                              [Search]  [+New] │
├───────────────────────────────────────┬───────────────────┤
│                                       │                   │
│ Conversations                         │ Chat with         │
│ (collapse on mobile)                  │ Dr. Ahmed Khan    │
│                                       │ Last seen: now    │
│ ┌─────────────────────────────────┐  │ ───────────────── │
│ │ Dr. Ahmed Khan         1         │  │ 3:45 PM Today    │
│ │ Your X-ray came back normal...   │  │ 👨 Doc: Results  │
│ │ 3 hours ago              ✓✓      │  │    came back! No │
│ └─────────────────────────────────┘  │    findings of... │
│                                       │                   │
│ ┌─────────────────────────────────┐  │ 3:52 PM          │
│ │ Dr. Sara                         │  │ 👩 Patient: Thank│
│ │ Hi Jane, how are you feeling...  │  │    you Dr!       │
│ │ Yesterday                        │  │                   │
│ └─────────────────────────────────┘  │ ───────────────── │
│                                       │ [Type message...] │
│                                       │ [📎 Attach] [📤] │
└───────────────────────────────────────┴───────────────────┘
```

### Components

**Conversation List Item** (left side)

When **unselected**:
```
Dr. Ahmed Khan              1
Your X-ray came back normal...
3 hours ago                      ✓✓
```
- Avatar: 40x40px, rounded
- Name: 14px, 600 weight
- Last message: 13px, secondary, truncated
- Time: 12px, muted
- Unread badge: Circle with number, red bg
- Read receipts: Double checkmark

When **selected** (highlighted):
- Background: `#F0F4FF` (light blue)
- Left border: `4px solid #0066CC`

**Message Bubble** (right side)

**From Doctor:**
```
┌──────────────────────────┐
│ Your X-ray results       │
│ came back normal! No     │
│ concerning findings.     │
│                          │
│ 3:45 PM · ✓✓            │
└──────────────────────────┘
```

- Background: `#E0EEFF` (light blue)
- Text: `#0F172A` (dark)
- Padding: 12px 16px
- Border-radius: 12px (but squared top-left since from them)
- Margin: 8px 0

**From Patient:**
```
                   ┌──────────────────────┐
                   │ Thank you Dr! I'm    │
                   │ very relieved!       │
                   │                      │
                   │ 3:52 PM · ✓✓        │
                   └──────────────────────┘
```

- Background: `#0066CC` (blue)
- Text: White
- Align: Right side
- Squared top-right since from them

**Message Meta**
- Timestamp: 11px, muted, below bubble
- Read receipts: Gray (sent), blue (delivered/read)
- Typing indicator: Animated dots "..."

**Input Area** (bottom)

```
┌─────────────────────────────────────────┐
│ Type your message here...   [📎] [📤]  │
└─────────────────────────────────────────┘
```

- Text area: Multi-line, grows as you type
- Placeholder: Light gray
- Border: `1px solid #E2E8F0`
- Border-radius: 8px
- Padding: 12px 14px
- Attach button: Icon, hover → blue
- Send button: Filled blue when text present, else disabled gray

---

## ANIMATION & MICRO-INTERACTIONS

### Button Click
```
[Normal] → (scale 0.98) → [Clicked] → (scale 1.0, color change) → [Hover]
Duration: 150ms
Easing: ease-out
```

### Card Hover
```
Shadow: 0 1px 3px rgba(0,0,0,0.08)
    ↓ on hover ↓
Shadow: 0 8px 24px rgba(0,0,0,0.12)
Transform: scale(1.01)
Duration: 200ms
```

### Modal Enter
```
Opacity: 0 → 1
Transform: scale(0.95) translate(0, -10px) → scale(1) translate(0, 0)
Duration: 300ms
Easing: cubic-bezier(0.16, 1, 0.3, 1)
```

### Loading Spinner
```
Rotation: 0° → 360°
Duration: 2s
Timing: linear infinite
Color: #0066CC
```

### Success Checkmark
```
Stroke-dashoffset: animate from full to 0
Scale: 0 → 1
Duration: 400ms
Easing: cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## RESPONSIVE BREAKPOINTS

### Mobile (320px - 640px)
- Single column layout
- Bottom navigation (tab bar)
- Full-width buttons
- Cards: Stacked
- Typography: -2px on body, -4px on headings
- Padding: 12px instead of 24px

### Tablet (641px - 1024px)
- 2-column layout where applicable
- Side navigation (collapsible)
- Larger touch targets
- Cards: 2 per row
- Standard padding (20px)

### Desktop (1025px+)
- 3+ column layouts
- Full sidebars
- Standard spacing

---

## DARK MODE ADJUSTMENTS

All colors have dark mode equivalents:

| Component | Light | Dark |
|-----------|-------|------|
| Background | `#FFFFFF` | `#0F172A` |
| Surface | `#F8FAFC` | `#1E293B` |
| Text Primary | `#0F172A` | `#F8FAFC` |
| Text Secondary | `#64748B` | `#94A3B8` |
| Border | `#E2E8F0` | `#334155` |
| Input BG | White | `#1E293B` |
| Card BG | `#F8FAFC` | `#1E293B` |

Accent colors remain the same for consistency and WCAG compliance.

---

## ACCESSIBILITY NOTES

✓ Button text is descriptive: "Generate Report" not "Go"
✓ Icons paired with text labels
✓ Focus visible: `2px solid #0066CC` outline
✓ Color not sole indicator: Uses icons + text for status
✓ Contrast ratio: 4.5:1 for body text
✓ Touch targets: Minimum 44x44px
✓ Skip navigation link present
✓ Form labels associated with inputs

