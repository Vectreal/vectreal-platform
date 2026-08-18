# @shared/utils

Shared utility helpers and API types for the Vectreal platform workspace.

## Exports

### Styling

- `cn(...inputs)`
  - Combines `clsx` + `tailwind-merge` for safe className composition.

### API responses

`ApiResponse` helpers for consistent JSON responses:

- `ApiResponse.success(data, status?, options?)`
- `ApiResponse.error(message, status?, options?)`
- `ApiResponse.withCookie(data, cookieHeader, status?)`
- `ApiResponse.badRequest(message)`
- `ApiResponse.methodNotAllowed(message?)`
- `ApiResponse.unauthorized(message?, options?)`
- `ApiResponse.forbidden(message?, options?)`
- `ApiResponse.notFound(message?, options?)`
- `ApiResponse.serverError(message?)`
- `ApiResponse.created(data, options?)`
- `ApiResponse.paymentRequired(message, quota?)`
- `ApiResponse.quotaExceeded(message, quota)`

`paymentRequired` and `quotaExceeded` attach the plan and limit context (`limitKey`,
`currentValue`, `limit`, `plan`, `upgradeTo`) the dashboard needs to render an upgrade
prompt.

### Formatting

- `formatFileSize(bytes)`
  - Formats bytes into `bytes`, `KB`, or `MB` strings.

### Slugs

- `slugify(name, fallback?)`
  - Converts a human-readable name into a URL and code-safe slug.
- `deriveUniqueSlug(name, existingIds, options?)`
  - Slugifies a name and appends a counter until it no longer collides with `existingIds`. Pass `options.excludeId` so a rename ignores the entry's own id.

### Types

Re-exported from `types/api-core`:

- `CsrfToken`
- `BaseRequest`
- `HttpStatus`
- `ApiError`
- `ApiResponseType<T>`

## Usage

```ts
import { ApiResponse, cn, formatFileSize } from '@shared/utils'

const classes = cn('rounded-md', isActive && 'ring-2')
const sizeText = formatFileSize(2097152)

return ApiResponse.success({ classes, sizeText })
```

## License

AGPL-3.0-only, covered by the repository-root [LICENSE.md](../../LICENSE.md).
