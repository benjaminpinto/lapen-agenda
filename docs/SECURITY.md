# Security Configuration

## Environment Variables Required

Add these to your `.env` file:

```bash
# Security
SECRET_KEY=your-secret-key-here-min-32-chars
ADMIN_PASSWORD=your-admin-password-here

# Environment
FLASK_ENV=production  # Use 'development' for local dev
```

## Security Features Implemented

### ✅ Authentication & Authorization
- JWT tokens for user authentication (7-day expiry)
- Session-based admin authentication
- Bcrypt password hashing
- Secure session cookies in production

### ✅ Input Validation
- Filename sanitization (path traversal prevention)
- Email format validation
- Password strength requirements (min 6 chars)
- Base64 image validation

### ✅ Secure Configuration
- Environment-based secret keys
- Secure cookies enabled in production
- CORS restricted to specific origins
- Debug mode disabled in production

## Security Checklist for Production

- [ ] Set strong `SECRET_KEY` (min 32 random characters)
- [ ] Set strong `ADMIN_PASSWORD` (min 12 characters)
- [ ] Set `FLASK_ENV=production`
- [ ] Enable HTTPS
- [ ] Update CORS origins to production URLs
- [ ] Review and rotate API keys (Stripe, Mercado Pago)
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Regular security updates

## Known Limitations

⚠️ **SQL Injection Risk**: Dynamic SQL in dashboard queries - review `get_month_comparison_sql()`
⚠️ **No Rate Limiting**: Consider adding Flask-Limiter
⚠️ **No CSRF Protection**: Consider adding Flask-WTF for forms

## Generating Secure Keys

```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Generate ADMIN_PASSWORD
python -c "import secrets; print(secrets.token_urlsafe(16))"
```
