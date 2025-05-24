# Contributing to DynamoDNS

Thank you for your interest in contributing to DynamoDNS! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please read it to understand what behavior will and will not be tolerated.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- Use the issue tracker to report bugs
- Before creating a new issue, check if the problem has already been reported
- When you create a new issue, include as many details as possible by filling out the provided template

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

- Use the issue tracker with the enhancement label
- Provide a clear and detailed explanation of the feature you want
- Explain why this enhancement would be useful to most DynamoDNS users

### Your First Code Contribution

Unsure where to begin contributing? Look for issues labeled:

- `good first issue` - issues which are good for newcomers
- `help wanted` - issues which need extra attention
- `documentation` - improvements or additions to documentation

### Pull Requests

- Fill in the required template
- Follow the coding style and standards
- Include appropriate test cases
- Update documentation for any new features
- End all files with a newline
- Place requires/imports in the following order:
  - Built-in Node Modules (e.g., 'path')
  - External Modules (e.g., 'express')
  - Internal Modules (e.g., './utils')

## Development Setup

To set up your development environment:

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Create a `.env` file with development settings
5. Run `npm run dev` to start the development server

See the [Development Guide](docs/development-guide.md) for more detailed instructions.

## Coding Guidelines

### JavaScript/TypeScript Style Guide

- We use TypeScript for type safety
- Follow the ESLint configuration included in the project
- Use Prettier for code formatting
- Write descriptive variable and function names
- Comment your code where necessary, especially complex logic

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - ✨ `:sparkles:` when adding a new feature
  - 🐛 `:bug:` when fixing a bug
  - 📚 `:books:` when adding or updating documentation
  - ♻️ `:recycle:` when refactoring code
  - 🧪 `:test_tube:` when adding tests
  - 🎨 `:art:` when improving the format/structure of the code

### Testing Guidelines

- Write tests for all new features and bug fixes
- Aim for high test coverage
- Test edge cases and error conditions
- Run the full test suite before submitting a pull request

## Pull Request Process

1. Ensure all tests pass
2. Update the documentation with details of changes
3. The pull request will be merged once it receives approval from maintainers

## Release Process

DynamoDNS follows semantic versioning. The release process is:

1. New features in master branch are bundled for a future release
2. Release candidates undergo additional testing
3. Final releases are tagged and published

## Questions?

If you have any questions, feel free to create an issue with the "question" label or contact the maintainers directly.

Thank you for contributing to DynamoDNS!