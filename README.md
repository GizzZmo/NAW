<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Neural Audio Workstation (NAW)

> **A Production-Grade AI Music Creation Environment**  
> Bridging the gap between generative AI and professional music production

[![Version](https://img.shields.io/badge/version-1.3.0-green.svg)]()
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)]()

## Key Features

### AudioWorklet & MIDI Integration (v1.3+)
- AudioWorklet engine initializes on first play/generate (look-ahead scheduler + meters).
- Web MIDI service enumerates input/output devices and receives note messages.
- Status indicators in the footer show Worklet readiness, MIDI device count, and live meters.

### Style-Aware Generation (v1.3)
The Semantic Planner now respects UI controls:
- **Style Adapter** (Jazz, Techno, Orchestral, Lo-fi, Ambient, Hip-hop)
- **Style Strength** (0–100%)
- **Temperature** (creativity control)
- **CLAP Audio Reference** (filename influences the prompt)

Right-click a clip → **Regenerate Clip** re-runs the planner focused on that stem.

See full documentation in the repository for architecture, roadmap, and usage.
