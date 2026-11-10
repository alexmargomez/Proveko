package cryptovault

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
)

type Envelope struct {
	KEKID      string `json:"kek_id"`
	WrappedDEK string `json:"wrapped_dek"`
	Ciphertext string `json:"ciphertext"`
}

type Vault struct {
	kekID string
	kek   [32]byte
}

func New(masterSecret string) *Vault {
	return &Vault{
		kekID: "kek-proveko-v3",
		kek:   sha256.Sum256([]byte(masterSecret)),
	}
}

func (v *Vault) Seal(tenantID, plainDSN string) (Envelope, error) {
	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return Envelope{}, err
	}
	wrapped, err := aesSeal(v.kek[:], dek, []byte(v.kekID+":"+tenantID))
	if err != nil {
		return Envelope{}, err
	}
	ct, err := aesSeal(dek, []byte(plainDSN), []byte(tenantID))
	if err != nil {
		return Envelope{}, err
	}
	return Envelope{
		KEKID:      v.kekID,
		WrappedDEK: base64.StdEncoding.EncodeToString(wrapped),
		Ciphertext: base64.StdEncoding.EncodeToString(ct),
	}, nil
}

func (v *Vault) Open(tenantID string, env Envelope) (string, error) {
	wBytes, err := base64.StdEncoding.DecodeString(env.WrappedDEK)
	if err != nil {
		return "", err
	}
	dek, err := aesOpen(v.kek[:], wBytes, []byte(env.KEKID+":"+tenantID))
	if err != nil {
		return "", err
	}
	cBytes, err := base64.StdEncoding.DecodeString(env.Ciphertext)
	if err != nil {
		return "", err
	}
	plain, err := aesOpen(dek, cBytes, []byte(tenantID))
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func aesSeal(key, plaintext, aad []byte) ([]byte, error) {
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, aad), nil
}

func aesOpen(key, payload, aad []byte) ([]byte, error) {
	blk, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(blk)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(payload) < ns {
		return nil, errors.New("invalid ciphertext length")
	}
	return gcm.Open(nil, payload[:ns], payload[ns:], aad)
}
