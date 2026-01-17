# Testing Rules

## Test Structure
- Use pytest framework for all tests
- Follow existing test patterns in `tests/` directory
- Use descriptive test names with `test_` prefix

## Test Setup
```python
import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

os.environ.setdefault('SECRET_KEY', 'test-secret-key-min-32-characters-long')
os.environ.setdefault('ADMIN_PASSWORD', 'test-admin-password')
```

## Database Fixtures
- Use `@pytest.fixture` with `setup_db` name
- Clean up test data before and after tests
- Use unique identifiers (email domains, years) to avoid conflicts
- Example:
```python
@pytest.fixture
def setup_db():
    db = get_db()
    # Delete test data
    db.execute("DELETE FROM users WHERE email LIKE '%@testdomain.com'")
    db.commit()
    db.close()
    yield
    # Cleanup after test
    db = get_db()
    db.execute("DELETE FROM users WHERE email LIKE '%@testdomain.com'")
    db.commit()
    db.close()
```

## Helper Functions
- Create helper functions for common operations (create_test_user, create_test_season, etc.)
- Place helpers outside test classes
- Use descriptive names

## Test Classes
- Group related tests in classes
- Use descriptive class names with `Test` prefix
- Example: `class TestWOResult:`

## Assertions
- Use clear assertion messages
- Test both success and error cases
- Verify database state after operations
- Example:
```python
assert response.status_code == 200
assert match['points_p1'] == -30  # Loser
assert match['points_p2'] == 132  # Winner
```

## Test Coverage
- Test happy path (valid inputs)
- Test edge cases (string vs int, null values)
- Test error handling (invalid inputs, missing data)
- Test side effects (database updates, stats changes)

## Running Tests
```bash
# Set DATABASE_URL for local testing
export DATABASE_URL="postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda"

# All tests
pytest tests/

# Specific file
pytest tests/test_wo_result.py -v

# With coverage
pytest tests/ --cov=src

# Single command with DATABASE_URL
DATABASE_URL="postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda" pytest tests/test_wo_result.py -v
```

## Examples
See existing test files:
- `tests/test_lapen_auth.py` - Authentication and authorization tests
- `tests/test_ranking_system.py` - Ranking system tests
- `tests/test_betting_scenarios.py` - Unit tests with mocks
- `tests/test_wo_result.py` - W.O. result tests
