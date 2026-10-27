# Security Policy

## Current Security Measures

### Authentication & Authorization
- Read endpoints are public (portfolio demo)
- Write endpoints (`POST`, `PUT`, `DELETE`) require an `X-API-Key` header matching `ADMIN_API_KEY`; with no key configured, writes are disabled
- All inputs validated via Pydantic schemas with length and amount limits

### Abuse & Cost Protection
- AI insights cached per project (24h) and rate-limited: 5/hour per IP, 50/day overall
- Excel export rate-limited; list endpoints paginated (max 100 rows)
- Project data passed to Claude as data only, with a system prompt against prompt injection
- An Anthropic monthly spend limit should be set in the Anthropic Console as a final backstop

### Data Protection
- Credentials stored in `.env` file — never committed to Git
- `.env` is listed in `.gitignore`
- `.env.example` provided with placeholders only
- PostgreSQL password protected locally

### API Security
- CORS configured to allow only specific origins
- CDN scripts pinned with Subresource Integrity hashes
- Input validation on all endpoints via Pydantic
- SQL injection protection via SQLAlchemy ORM

### Dependencies
- All dependencies pinned in `requirements.txt`
- Virtual environment isolated from global Python

## Known Limitations (Production Roadmap)

- [ ] Add JWT authentication for all endpoints
- [x] Add API key authentication for write endpoints
- [ ] Implement account lockout after failed attempts
- [ ] Add HTTPS enforcement in production
- [ ] Add request logging and monitoring
- [ ] Encrypt sensitive data at rest
- [ ] Add input sanitization beyond Pydantic validation
- [ ] Implement refresh tokens

## Reporting a Vulnerability

If you discover a security vulnerability, please open an issue on GitHub.

## Environment Variables

Never commit real values. Use `.env.example` as reference:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
APP_NAME=Construction Analytics API
DEBUG=True
ANTHROPIC_API_KEY=your_api_key_here
ADMIN_API_KEY=a-long-random-string
```