package main

import (
	"math/rand"
	"net/http"
	"time"

	goerrors "github.com/go-errors/errors"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

func main() {
	rand.Seed(time.Now().UTC().UnixNano())

	// http handler
	r := mux.NewRouter()
	// TODO: add handlers here

	server := &http.Server{
		Addr:         "localhost:10101",
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logrus.WithError(err).Error("error while serving http server")
	}
}

func wrap(path string, f func(http.ResponseWriter, *http.Request)) (string, func(http.ResponseWriter, *http.Request)) {
	wrapped := func(w http.ResponseWriter, r *http.Request) {
		// catch panic
		defer func() {
			r := recover()
			if r != nil {
				panicErr := goerrors.Wrap(r, 1)
				logrus.WithError(panicErr).WithField("path", path).Error("panicked at handler")
			}
		}()
	}
	return path, wrapped
}
