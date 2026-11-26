package apperr

import "errors"

type Kind string

const (
	KindValidation      Kind = "VALIDATION"
	KindUnauthorized    Kind = "UNAUTHORIZED"
	KindForbidden       Kind = "FORBIDDEN"
	KindNotFound        Kind = "NOT_FOUND"
	KindConflict        Kind = "CONFLICT"
	KindPayloadTooLarge Kind = "PAYLOAD_TOO_LARGE"
	KindUnprocessable   Kind = "UNPROCESSABLE"
	KindUpstream        Kind = "UPSTREAM"
	KindInternal        Kind = "INTERNAL"
)

type Error struct {
	Kind    Kind
	Message string
	Cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.Cause }

func New(kind Kind, msg string) *Error              { return &Error{Kind: kind, Message: msg} }
func Wrap(kind Kind, msg string, cause error) *Error { return &Error{Kind: kind, Message: msg, Cause: cause} }

func Validation(msg string) *Error      { return New(KindValidation, msg) }
func Unauthorized(msg string) *Error    { return New(KindUnauthorized, msg) }
func Forbidden(msg string) *Error       { return New(KindForbidden, msg) }
func NotFound(msg string) *Error        { return New(KindNotFound, msg) }
func Conflict(msg string) *Error        { return New(KindConflict, msg) }
func PayloadTooLarge(msg string) *Error { return New(KindPayloadTooLarge, msg) }
func Unprocessable(msg string) *Error   { return New(KindUnprocessable, msg) }
func Upstream(msg string) *Error        { return New(KindUpstream, msg) }
func Internal(msg string) *Error        { return New(KindInternal, msg) }

func IsKind(err error, kind Kind) bool {
	var target *Error
	if errors.As(err, &target) {
		return target.Kind == kind
	}
	return false
}

func HTTPStatus(err error) int {
	var target *Error
	if !errors.As(err, &target) {
		return 500
	}
	switch target.Kind {
	case KindValidation:
		return 400
	case KindUnauthorized:
		return 401
	case KindForbidden:
		return 403
	case KindNotFound:
		return 404
	case KindConflict:
		return 409
	case KindPayloadTooLarge:
		return 413
	case KindUnprocessable:
		return 422
	case KindUpstream:
		return 502
	default:
		return 500
	}
}

func FromHTTPStatus(status int, message, upstreamName string) error {
	if message == "" {
		message = "Error de comunicación con " + upstreamName
	}
	switch status {
	case 400:
		return Validation(message)
	case 401:
		return Unauthorized(message)
	case 403:
		return Forbidden(message)
	case 404:
		return NotFound(message)
	case 409:
		return Conflict(message)
	case 413:
		return PayloadTooLarge(message)
	case 422:
		return Unprocessable(message)
	case 502, 503, 504:
		return Upstream(message)
	default:
		return Internal(message)
	}
}
