# Code Reuse Rule

## Principle
Always prefer code reuse over duplication. When implementing new functionality:

1. **Check for existing methods** that can be extended or refactored instead of creating new ones
2. **Consolidate similar logic** into unified methods with parameters for variations
3. **Refactor existing methods** to be more generic rather than creating specialized duplicates
4. **Use composition over duplication** - break down complex operations into reusable components

## Guidelines
- Before writing new code, search for similar existing implementations
- If you find duplicate logic, refactor it into a shared method
- Prefer extending existing methods with optional parameters over creating new ones
- Keep methods focused but flexible enough to handle related use cases
- Document any breaking changes when refactoring existing methods

## Examples
- Instead of `set_match_result()` and `set_wo_result()`, create unified `_update_match_result()` 
- Instead of separate validation methods, create parameterized validation functions
- Instead of duplicate database update logic, create reusable update helpers