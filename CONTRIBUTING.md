# Contributing to Neural Audio Workstation (NAW)

Thank you for your interest in contributing to NAW! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Areas for Contribution](#areas-for-contribution)

## Code of Conduct

This project follows a simple code of conduct:

- **Be respectful** of other contributors and maintainers
- **Be constructive** in criticism and feedback
- **Focus on the code**, not the person
- **Assume good intentions** when interpreting others' contributions

## Getting Started

### Prerequisites

- **Node.js** v18 or later
- **npm** or **yarn**
- **Git** for version control
- **Code editor** (VS Code recommended)

### Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/NAW.git
   cd NAW
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a `.env.local` file** with your API keys:
   ```
   VITE_GEMINI_API_KEY=your_key_here
   ```
5. **Run the dev server**:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Strategy

- **`main`**: Production-ready code
- **Feature branches**: `feature/your-feature-name`
- **Bug fixes**: `fix/bug-description`
- **Documentation**: `docs/what-you-are-documenting`

### Creating a Feature Branch

```bash
git checkout -b feature/my-new-feature
```

### Making Changes

1. Make your changes in small, logical commits
2. Test your changes locally
3. Ensure no TypeScript errors: `npm run build`
4. Update documentation if needed

## Coding Standards

### TypeScript

- **Use strict types**: No `any` types unless absolutely necessary
- **Document complex types**: Add JSDoc comments
- **Follow existing patterns**: Match the style of surrounding code

### React Components

- **Functional components** with hooks (no class components)
- **Props interface** for every component
- **Meaningful names**: `SpectrogramEditor`, not `Component1`

### File Organization

```
/components       # React components
/services         # Business logic (API calls, audio engine)
/types.ts         # TypeScript interfaces
/constants.ts     # Configuration values
/data             # Static data (presets)
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `SpectrogramEditor` |
| Files | Match component | `SpectrogramEditor.tsx` |
| Functions | camelCase | `handleGenerate()` |
| Constants | UPPER_SNAKE_CASE | `TOTAL_BARS` |
| Interfaces | PascalCase | `ProjectState` |

### Code Style

- **Indentation**: 2 spaces
- **Semicolons**: Optional (follow existing file style)
- **Quotes**: Single quotes for strings, double for JSX attributes
- **Line length**: Aim for <100 characters

## Commit Guidelines

### Commit Message Format

```
<type>: <short summary>

<optional longer description>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, no logic change)
- **refactor**: Code restructuring (no feature/fix)
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat: Add CLAP audio conditioning to generation pipeline

docs: Update ARCHITECTURE.md with Flow Matching details

fix: Resolve playback stutter on long tracks

refactor: Extract audio synthesis to separate module
```

## Pull Request Process

### Before Submitting

1. **Test thoroughly**: Ensure your changes work as expected
2. **Update documentation**: README, ARCHITECTURE, inline comments
3. **Check TypeScript**: `npm run build` should succeed
4. **Review your changes**: Use `git diff` to check what you're committing

### Creating a PR

1. Push your branch to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
2. Open a PR on GitHub
3. Fill out the PR template:
   - **Description**: What does this PR do?
   - **Motivation**: Why is this change needed?
   - **Testing**: How did you test it?
   - **Screenshots**: For UI changes

### PR Review

- **Maintainers will review** your PR within 3-7 days
- **Address feedback** by pushing new commits
- **Don't force-push** during review (makes it hard to track changes)
- **Squash commits** may be requested before merge

## Areas for Contribution

### 🔴 High Priority

**Neural Engine Integration**
- Implement DAC audio codec in TypeScript/WASM
- Build Flow Matching inference pipeline
- Integrate ControlNet adapters

**Performance**
- Optimize spectrogram rendering (use WebGL/Canvas offscreen)
- Reduce audio latency
- Implement audio buffering for large projects

**Testing**
- Unit tests for service layer
- Integration tests for generation flow
- E2E tests for UI workflows

### 🟡 Medium Priority

**UI/UX Improvements**
- Dark/light theme toggle
- Keyboard shortcuts
- Undo/redo system
- Better mobile responsiveness

**Features**
- MIDI file import/export
- WAV file export per stem
- Audio effects (reverb, delay, EQ)
- Preset management (user presets)

### 🟢 Nice to Have

**Documentation**
- Video tutorials
- Interactive demo
- API reference documentation
- Contributor guide improvements

**Community**
- Discord server setup
- Example projects
- Showcase gallery

## Questions?

- **Issues**: https://github.com/GizzZmo/NAW/issues
- **Discussions**: https://github.com/GizzZmo/NAW/discussions

---

**Thank you for contributing to NAW!** 🎵
