# Contributing to SuperBloom

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Open `http://localhost:5173` in your browser

## Making Changes

1. Create a branch from `main`: `git checkout -b my-feature`
2. Make your changes
3. Test that the app builds cleanly: `npm run build`
4. Commit with a clear message describing what you changed
5. Push and open a pull request

## Code Style

- The project uses tabs for indentation
- Svelte components follow standard Svelte 4 conventions
- Keep functions focused and well-named
- Add comments for non-obvious logic, especially in image processing code

## What to Work On

- Check the [Issues](../../issues) tab for open tasks
- Bug fixes and performance improvements are always welcome
- If you want to add a new feature, open an issue first to discuss the approach

## Presets

If you've created a cool preset, feel free to submit it! Add a JSON file to `src/lib/presets/` and register it in `+page.svelte`.

## Reporting Bugs

When filing a bug report, please include:

- What you expected to happen
- What actually happened
- Browser and OS
- A sample image if the issue is visual

## Questions?

Open an issue with the "question" label and we'll get back to you.
