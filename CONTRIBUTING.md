<div align="center">

# Contributing to Plasma Testnet MCP Server

**Thank you for your interest in contributing to the Plasma Testnet MCP Server!**

This document provides guidelines and instructions for contributing to this project.

</div>

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community for all developers in the blockchain and DeFi space.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any relevant logs or screenshots
- Your environment (OS, Node.js version, npm version)
- Transaction hashes if applicable

### Suggesting Enhancements

If you have an idea for an enhancement, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the enhancement
- Any relevant examples or mockups
- Why this enhancement would be useful for the Plasma Network ecosystem
- Potential implementation approach

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bugfix (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) as your PR's title

## Development Setup

1. Clone your fork:
```bash
git clone https://github.com/your-username/plasma-mcp.git
cd plasma-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
# Edit .env with your Plasma Network configuration
```

4. Run the development server:
```bash
npm run dev
```

5. Test the MCP server:
```bash
npm run mcp
```

## Code Style

- Use 2 spaces for indentation
- Use semicolons at the end of statements
- Use single quotes for strings (except to avoid escaping)
- Add trailing commas in objects and arrays
- Use `const` for all variables that are not reassigned
- Use meaningful variable names
- Write self-documenting code

## Testing

Before submitting a pull request:

1. Ensure all existing tests pass
2. Add tests for any new functionality
3. Test both success and error scenarios
4. Verify your changes work with Claude Desktop
5. Test on Plasma testnet if applicable

## Documentation

- Update README.md if you change functionality
- Add JSDoc comments for public APIs
- Include examples for new features
- Keep documentation concise but comprehensive

## Adding New Tools

When adding a new tool to the MCP server:

1. Define the Zod schema for validation
2. Register the tool with the server using the `server.tool()` method
3. Add comprehensive error handling
4. Update the README.md with the new tool documentation
5. Add tests for the new tool
6. Consider gas optimization for blockchain operations

## Questions?

Feel free to open an issue with your question or reach out to the maintainers directly.

---

<div align="center">

**Built by [Tairon.ai](https://tairon.ai) team**

</div>