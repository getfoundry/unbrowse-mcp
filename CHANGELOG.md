# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-12-02

### Added
- x402 payment mode with Solana USDC (pay-per-request, no account required)
- `get_payment_history` tool for x402 mode
- Comprehensive documentation at [getfoundry.gitbook.io/unbrowse](https://getfoundry.gitbook.io/unbrowse/)

### Changed
- API base URL updated to `https://index.unbrowse.ai`
- Sentry error tracking is now opt-in via `SENTRY_DSN` environment variable
- Improved package metadata and keywords

### Removed
- Internal documentation files (now available on GitBook)

## [1.0.1] - 2025-12-02

### Changed
- Documentation updates

## [1.0.0] - 2025-10-25

### Added
- Initial release
- API key and session token authentication
- `search_abilities` - Search indexed web abilities
- `execute_abilities` - Execute multiple abilities in parallel
- `search_abilities_parallel` - Run multiple searches simultaneously
- `ingest_api_endpoint` - Index new API endpoints
- Zero-knowledge credential encryption
- Automatic credential injection
