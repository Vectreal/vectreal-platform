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

### Formatting

- `formatFileSize(bytes)`
  - Formats bytes into `bytes`, `KB`, or `MB` strings.

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

See LICENSE.md in this package.
