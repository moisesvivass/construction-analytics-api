# Security Policy

## Current Security Measures

### Authentication & Authorization
- API is currently open (no authentication) — designed for internal/demo use
- Row-level security enforced on all database queries
- All inputs validated via Pydantic schemas before processing

### Data Protection
- Credentials stored in `.env` file — never committed to Git
- `.env` is listed in `.gitignore`
- `.env.example` provided with placeholders only
- PostgreSQL password protected locally

### API Security
- CORS configured to allow only specific origins
- Rate limiting enabled via SlowAPI
- Input validation on all endpoints via Pydantic
- SQL injection protection via SQLAlchemy ORM

### Dependencies
- All dependencies pinned in `requirements.txt`
- Virtual environment isolated from global Python

## Known Limitations (Production Roadmap)

- [ ] Add JWT authentication for all endpoints
- [ ] Add API key authentication for external consumers
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
```