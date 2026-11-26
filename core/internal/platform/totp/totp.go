package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	PeriodSeconds = 30
	Digits        = 6
)

var b32NoPad = base32.StdEncoding.WithPadding(base32.NoPadding)

func GenerateSecret() (string, error) {
	raw := make([]byte, 20)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return b32NoPad.EncodeToString(raw), nil
}

func BuildOTPAuthURI(issuer, accountEmail, secret string) string {
	cleanIssuer := strings.TrimSpace(issuer)
	if cleanIssuer == "" {
		cleanIssuer = "Proveko Platform"
	}
	cleanAccount := strings.TrimSpace(accountEmail)
	label := url.PathEscape(cleanIssuer + ":" + cleanAccount)
	q := url.Values{}
	q.Set("secret", strings.ToUpper(strings.TrimSpace(secret)))
	q.Set("issuer", cleanIssuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", fmt.Sprintf("%d", Digits))
	q.Set("period", fmt.Sprintf("%d", PeriodSeconds))
	return "otpauth://totp/" + label + "?" + q.Encode()
}

func GenerateCode(secret string, at time.Time) (string, error) {
	norm := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(secret), " ", ""))
	key, err := b32NoPad.DecodeString(norm)
	if err != nil {
		return "", err
	}
	counter := uint64(at.Unix() / PeriodSeconds)
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(buf[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	code := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])
	otp := code % 1000000
	return fmt.Sprintf("%06d", otp), nil
}

func VerifyCode(secret, code string, now time.Time) bool {
	cleanCode := strings.TrimSpace(code)
	if len(cleanCode) != Digits {
		return false
	}
	for _, delta := range []int64{-1, 0, 1} {
		stepTime := now.Add(time.Duration(delta*PeriodSeconds) * time.Second)
		expected, err := GenerateCode(secret, stepTime)
		if err != nil {
			return false
		}
		if subtle.ConstantTimeCompare([]byte(cleanCode), []byte(expected)) == 1 {
			return true
		}
	}
	return false
}
