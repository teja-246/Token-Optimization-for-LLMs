# — Makefile
# Run `make proto` once after any .proto file change.
# Commit the generated files — teammates should not need protoc installed.


SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -Command

PROTO_DIR   := proto
GO_OUT      := go/gen
PYTHON_OUT  := python/gen

.PHONY: proto proto-go proto-python install-tools

## Generate all proto bindings (Go + Python)
proto: proto-go proto-python

## Generate Go bindings
proto-go:
	@mkdir -p $(GO_OUT)/cache
	protoc --go_out=$(GO_OUT) --go_opt=paths=source_relative --go-grpc_out=$(GO_OUT) --go-grpc_opt=paths=source_relative -I $(PROTO_DIR) $(PROTO_DIR)/cache.proto
	@echo "Go bindings generated → $(GO_OUT)/cache/"

## Generate Python bindings
proto-python:
	@mkdir -p $(PYTHON_OUT)
	@touch $(PYTHON_OUT)/__init__.py
	python -m grpc_tools.protoc --python_out=$(PYTHON_OUT) --grpc_python_out=$(PYTHON_OUT) -I $(PROTO_DIR) $(PROTO_DIR)/cache.proto
	@echo "Python bindings generated → $(PYTHON_OUT)/"

## Install protoc plugins (run once on a fresh machine)
install-tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	pip install grpcio-tools

## Run all Go tests
test-go:
	cd go && go test ./...

## Run all Python tests
test-python:
	cd python && python -m pytest tests/ -v

## Start all infrastructure
up:
	docker-compose up -d

## Stop all infrastructure
down:
	docker-compose down