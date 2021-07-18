package config

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"

	"github.com/caarlos0/env/v6"
)

type config struct {
	SQLUser     string `env:"SQL_USERNAME" envDefault:""`
	SQLPassword string `env:"SQL_PASSWORD" envDefault:""`
	SQLHost     string `env:"SQL_HOST" envDefault:"127.0.0.1"`
	SQLPort     int    `env:"SQL_PORT" envDefault:"5432"`
	SQLDBName   string `env:"SQL_DBNAME" envDefault:"reservation"`

	ListenAddr string `env:"LISTEN_ADDR" envDefault:"localhost:10101"`

	JWTPublicKeyPath string `env:"JWT_PUBLIC_KEY_PATH" envDefault:"jwt.pub"`
	JWTPublicKey     *ecdsa.PublicKey
	JWTAudience      string `env:"JWT_AUDIENCE" envDefault:"bacchus-snu:reservation"`
	JWTIssuer        string `env:"JWT_ISSUER" envDefault:"bacchus-snu:id"`

	// bypasses jwt auth
	DevMode bool `env:"DEV_MODE" envDefault:"false"`
	// test flag (is running with `go test`)
	IsTest bool `env:"IS_TEST" envDefault:"false"`

	ScheduleRepeatLimit int `env:"SCHEDULE_REPEAT_LIMIT" envDefault:"20"`
}

var Config *config

func Parse() error {
	if Config != nil {
		return fmt.Errorf("config was already parsed")
	}
	Config = new(config)
	if err := env.Parse(Config); err != nil {
		return err
	}

	if !Config.IsTest {
		keyBytes, err := os.ReadFile(Config.JWTPublicKeyPath)
		if err != nil {
			return err
		}

		block, _ := pem.Decode(keyBytes)
		pubIface, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return err
		}
		pub, ok := pubIface.(*ecdsa.PublicKey)
		if !ok || pub == nil {
			return fmt.Errorf("public key alg is not ecdsa")
		}
		Config.JWTPublicKey = pub
	}

	return nil
}
