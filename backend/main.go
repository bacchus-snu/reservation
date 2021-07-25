package main

import (
	"math/rand"
	"net/http"
	"time"

	"github.com/bacchus-snu/reservation/config"
	"github.com/bacchus-snu/reservation/handler"
	"github.com/bacchus-snu/reservation/sql"
	goerrors "github.com/go-errors/errors"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

func main() {
	rand.Seed(time.Now().UTC().UnixNano())
	if err := config.Parse(); err != nil {
		logrus.WithError(err).Fatal("failed to parse configuration")
	}

	if config.Config.DevMode {
		logrus.SetLevel(logrus.DebugLevel)
	}

	if err := sql.Connect(); err != nil {
		logrus.WithError(err).Fatal("failed to connect to database")
	}

	// http handler
	r := mux.NewRouter()
	r.HandleFunc(wrap("/api/schedule/add", handler.HandleAddSchedule)).Methods("POST")
	r.HandleFunc(wrap("/api/schedule/delete", handler.HandleDeleteSchedule)).Methods("POST")

	server := &http.Server{
		Addr:         config.Config.ListenAddr,
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
		f(w, r)
	}
	return path, wrapped
}
