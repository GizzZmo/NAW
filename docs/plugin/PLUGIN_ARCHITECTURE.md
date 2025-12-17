# VST/VSTi/AU Plugin Architecture (JUCE)

## Overview

This document outlines the architecture for implementing NAW as a VST3/AU plugin using the JUCE framework. The plugin will enable professional producers to use NAW's AI generation capabilities directly inside their DAW.

## Phase 4 Implementation

**Status**: Planned (Q4 2025)  
**Goal**: Real-time AI music generation as a plugin

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DAW (Host Application)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           NAW Plugin (VST3/AU/AAX)                    │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  UI Thread (JUCE + Embedded React)           │    │  │
│  │  │  • Timeline view                             │    │  │
│  │  │  • Mixer controls                            │    │  │
│  │  │  • Parameter automation                      │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │                        ↕                              │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  Audio Thread (C++ Real-Time Safe)           │    │  │
│  │  │  • ONNX Runtime / TensorRT inference         │    │  │
│  │  │  • Audio buffer management                   │    │  │
│  │  │  • Lookahead scheduling                      │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  │                        ↕                              │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  Model Manager (Background Thread)           │    │  │
│  │  │  • Load neural models (.onnx/.neutone)       │    │  │
│  │  │  • GPU memory management                     │    │  │
│  │  │  • Model warmup and caching                  │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Plugin Processor (`NAWProcessor.cpp`)

**Responsibilities:**
- Manage audio I/O buffers
- Handle DAW automation
- Schedule neural inference
- Implement lookahead compensation

**Key Methods:**
```cpp
class NAWProcessor : public juce::AudioProcessor {
public:
    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void processBlock(juce::AudioBuffer<float>& buffer,
                     juce::MidiBuffer& midiMessages) override;
    void releaseResources() override;
    
    // Latency reporting
    int getLatencySamples() const override {
        return LOOKAHEAD_BARS * SAMPLES_PER_BAR;
    }

private:
    // Neural engine
    std::unique_ptr<NeuralEngine> neuralEngine;
    
    // Lookahead buffer (4 bars)
    juce::AudioBuffer<float> lookaheadBuffer;
    
    // Generation queue
    std::queue<GenerationTask> taskQueue;
};
```

**Audio Thread Constraints:**
- NO memory allocation
- NO disk I/O
- NO mutex locks (use lock-free structures)
- NO system calls
- Target: <100ms latency

---

### 2. Plugin Editor (`NAWEditor.cpp`)

**Responsibilities:**
- Render UI
- Handle user interactions
- Display real-time visualization
- Communicate with processor via thread-safe messages

**UI Options:**

#### Option A: Native JUCE Components
```cpp
class NAWEditor : public juce::AudioProcessorEditor {
public:
    NAWEditor(NAWProcessor& p);
    
    void paint(juce::Graphics& g) override;
    void resized() override;

private:
    // UI components
    juce::Slider volumeSlider;
    juce::Button generateButton;
    TimelineComponent timeline;
    MixerComponent mixer;
};
```

#### Option B: Embedded Web View (React)
```cpp
class NAWEditor : public juce::AudioProcessorEditor {
public:
    NAWEditor(NAWProcessor& p);

private:
    // Embedded Chromium or WebView2
    juce::WebBrowserComponent webView;
    
    // Bridge for JS ↔ C++ communication
    void handleJavaScriptCall(const juce::String& message);
};
```

**Recommendation**: Start with native JUCE, migrate to WebView if needed

---

### 3. Neural Engine Integration

**ONNX Runtime Integration:**
```cpp
class NeuralEngine {
public:
    void initialize(const juce::File& modelPath);
    
    // Run inference (called from background thread)
    AudioBuffer<float> generate(const GenerationParams& params);
    
    // Check if inference complete
    bool isReady() const;

private:
    Ort::Env env;
    Ort::Session session;
    
    // TensorRT execution provider
    Ort::SessionOptions sessionOptions;
};
```

**Model Loading:**
- Load models on plugin initialization (background thread)
- Keep models in GPU memory
- Minimize transfers between CPU ↔ GPU

---

### 4. Lookahead Scheduling

**Challenge**: Neural generation takes time, but audio must be real-time

**Solution**: Lookahead buffering
```
┌────────────────────────────────────────────────────────┐
│  Timeline:                                             │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤   │
│  0     1     2     3     4     5     6     7     8     │
│                                                         │
│  Playhead at bar 4:                                    │
│  • DAW requests bars 4-5 (now)                         │
│  • Plugin returns pre-generated bars 4-5               │
│  • Plugin triggers generation for bars 8-9 (ahead)     │
│                                                         │
│  Lookahead: 4 bars (configurable)                      │
└────────────────────────────────────────────────────────┘
```

**Implementation:**
```cpp
void NAWProcessor::processBlock(AudioBuffer<float>& buffer,
                                MidiBuffer& midiMessages) {
    // 1. Check current playhead position
    auto playhead = getPlayHead();
    auto currentBar = playhead->getPosition()->getPpqPosition() / 4.0;
    
    // 2. Return audio from lookahead buffer
    buffer.copyFrom(0, 0, lookaheadBuffer, 0, buffer.getNumSamples());
    
    // 3. Schedule generation for future bars
    auto futureBar = currentBar + LOOKAHEAD_BARS;
    if (!isBarScheduled(futureBar)) {
        scheduleGeneration(futureBar);
    }
}
```

---

### 5. Parameter Automation

**DAW-Automatable Parameters:**
- Style strength (0-100%)
- Temperature (0-100%)
- Stem volumes (0-100% × 4)
- Stem mutes (on/off × 4)
- Active style adapter (enum)

**Implementation:**
```cpp
// Register parameters
auto params = std::make_unique<AudioProcessorValueTreeState::ParameterLayout>();

params->add(std::make_unique<AudioParameterFloat>(
    "style_strength",
    "Style Strength",
    NormalisableRange<float>(0.0f, 1.0f),
    0.7f
));

params->add(std::make_unique<AudioParameterChoice>(
    "style_adapter",
    "Style",
    juce::StringArray{"Jazz", "Techno", "Orchestral", "Lo-fi"},
    0
));
```

---

### 6. MIDI Input Support

**Use Case**: Condition generation on MIDI melody
```cpp
void NAWProcessor::processBlock(AudioBuffer<float>& buffer,
                                MidiBuffer& midiMessages) {
    // Extract MIDI notes
    MidiBuffer::Iterator it(midiMessages);
    MidiMessage message;
    int samplePosition;
    
    while (it.getNextEvent(message, samplePosition)) {
        if (message.isNoteOn()) {
            // Store note for conditioning
            activeMidiNotes.push_back(message.getNoteNumber());
        }
    }
    
    // Pass MIDI to neural engine as control signal
    neuralEngine->setMelodyCondition(activeMidiNotes);
}
```

---

### 7. Preset Management

**Preset System:**
- Save/load plugin state
- Include model parameters, UI state, generated audio
- Compatible with DAW preset systems

**Implementation:**
```cpp
void NAWProcessor::getStateInformation(MemoryBlock& destData) override {
    // Serialize state to XML
    auto state = parameters.copyState();
    auto xml = state.createXml();
    
    // Add custom data
    xml->setAttribute("generated_audio_hash", audioHash);
    xml->setAttribute("active_adapter", currentAdapter);
    
    copyXmlToBinary(*xml, destData);
}

void NAWProcessor::setStateInformation(const void* data, int sizeInBytes) override {
    auto xml = getXmlFromBinary(data, sizeInBytes);
    if (xml != nullptr) {
        auto state = ValueTree::fromXml(*xml);
        parameters.replaceState(state);
        
        // Restore custom data
        loadAdapter(xml->getStringAttribute("active_adapter"));
    }
}
```

---

## Build System

### CMake Configuration

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(NAW_Plugin VERSION 1.0.0)

# Add JUCE
add_subdirectory(external/JUCE)

# Plugin target
juce_add_plugin(NAW
    COMPANY_NAME "NAW Audio"
    PLUGIN_MANUFACTURER_CODE NAWa
    PLUGIN_CODE NAwp
    FORMATS VST3 AU AAX
    PRODUCT_NAME "Neural Audio Workstation"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
)

# Sources
target_sources(NAW PRIVATE
    src/NAWProcessor.cpp
    src/NAWEditor.cpp
    src/NeuralEngine.cpp
    src/TimelineComponent.cpp
    src/MixerComponent.cpp
)

# Link libraries
target_link_libraries(NAW PRIVATE
    juce::juce_audio_processors
    juce::juce_audio_devices
    juce::juce_audio_utils
    onnxruntime  # ONNX Runtime
)
```

---

## Deployment

### Installer Packages

**Windows:**
- VST3: `C:\Program Files\Common Files\VST3\NAW.vst3`
- Models: `C:\ProgramData\NAW\models\`

**macOS:**
- VST3: `~/Library/Audio/Plug-Ins/VST3/NAW.vst3`
- AU: `~/Library/Audio/Plug-Ins/Components/NAW.component`
- AAX: `~/Library/Application Support/Avid/Audio/Plug-Ins/NAW.aaxplugin`
- Models: `~/Library/Application Support/NAW/models/`

**Linux:**
- VST3: `~/.vst3/NAW.vst3`
- Models: `~/.config/NAW/models/`

---

## Performance Targets

### Latency Budget (per bar)
- **Encoding (DAC)**: 10ms
- **Planning (AR)**: 30ms
- **Rendering (Flow)**: 50ms
- **Decoding (DAC)**: 10ms
- **Total**: 100ms ✓

### Hardware Requirements
- **Minimum**: NVIDIA GTX 1660 (6GB VRAM)
- **Recommended**: NVIDIA RTX 3060 (12GB VRAM)
- **Optimal**: NVIDIA RTX 3090/4090 (24GB VRAM)

### Buffer Sizes
- 64 samples: ~1.5ms (challenging for real-time)
- 128 samples: ~2.9ms (achievable)
- 256 samples: ~5.8ms (recommended)
- 512 samples: ~11.6ms (safe)

---

## Testing Strategy

### Unit Tests
- Audio buffer handling
- Lookahead scheduling
- Parameter automation
- Preset save/load

### Integration Tests
- DAW compatibility (Ableton, Logic, FL Studio, etc.)
- MIDI input handling
- Automation recording/playback

### Performance Tests
- Measure inference latency
- Check for audio dropouts
- Monitor CPU/GPU usage
- Validate real-time safety (no allocations)

---

## Future Enhancements

### Neutone SDK Integration
- Allow third-party models as `.neutone` files
- Platform for researchers to publish NAW-compatible models

### Cloud Rendering (Optional)
- For users without powerful GPUs
- API endpoint: Send prompt → Receive stems
- Pay-per-generation pricing

---

## References

- JUCE Framework: https://juce.com/
- ONNX Runtime: https://onnxruntime.ai/
- TensorRT: https://developer.nvidia.com/tensorrt
- VST3 SDK: https://steinbergmedia.github.io/vst3_doc/
- Audio Unit: https://developer.apple.com/documentation/audiounit
- AAX: https://www.avid.com/alliance-partner-program/aax

---

**Last Updated**: December 17, 2025  
**Status**: Architecture design complete, implementation planned for Q4 2025
