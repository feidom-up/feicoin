BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
COMMIT := $(shell git log -1 --format='%H')
APPNAME := feicoin

# do not override user values
ifeq (,$(VERSION))
  VERSION := $(shell git describe --exact-match 2>/dev/null)
  # if VERSION is empty, then populate it with branch name and raw commit hash
  ifeq (,$(VERSION))
    VERSION := $(BRANCH)-$(COMMIT)
  endif
endif

# Update the ldflags with the app, client & server names
ldflags = -X github.com/cosmos/cosmos-sdk/version.Name=$(APPNAME) \
	-X github.com/cosmos/cosmos-sdk/version.AppName=$(APPNAME)d \
	-X github.com/cosmos/cosmos-sdk/version.Version=$(VERSION) \
	-X github.com/cosmos/cosmos-sdk/version.Commit=$(COMMIT)

BUILD_FLAGS := -ldflags '$(ldflags)'

####################
###  Quick Start ###
####################

start:
	@echo "🚀 启动 FeiCoin 区块链服务..."
	@./start.sh

dev: start

serve:
	@echo "🚀 启动所有服务..."
	@CGO_ENABLED=0 ./start.sh

blockchain-only:
	@echo "⛓️ 仅启动区块链服务..."
	@CGO_ENABLED=0 ignite chain serve --skip-proto

wallet-server:
	@echo "📊 启动钱包管理服务..."
	@node wallet-manager.js

stop:
	@echo "🛑 停止所有服务..."
	@pkill -f "feicoind" 2>/dev/null || true
	@pkill -f "wallet-manager.js" 2>/dev/null || true
	@pkill -f "ignite chain serve" 2>/dev/null || true
	@echo "✅ 所有服务已停止"

build-with-cgo:
	@echo "🔨 构建项目 (启用CGO)..."
	@go build $(BUILD_FLAGS) -mod=readonly ./cmd/$(APPNAME)d

build-no-cgo:
	@echo "🔨 构建项目 (禁用CGO)..."
	@CGO_ENABLED=0 go build $(BUILD_FLAGS) -mod=readonly ./cmd/$(APPNAME)d

.PHONY: start dev serve blockchain-only wallet-server stop build-with-cgo build-no-cgo

##############
###  Test  ###
##############

test-unit:
	@echo Running unit tests...
	@go test -mod=readonly -v -timeout 30m ./...

test-race:
	@echo Running unit tests with race condition reporting...
	@go test -mod=readonly -v -race -timeout 30m ./...

test-cover:
	@echo Running unit tests and creating coverage report...
	@go test -mod=readonly -v -timeout 30m -coverprofile=$(COVER_FILE) -covermode=atomic ./...
	@go tool cover -html=$(COVER_FILE) -o $(COVER_HTML_FILE)
	@rm $(COVER_FILE)

bench:
	@echo Running unit tests with benchmarking...
	@go test -mod=readonly -v -timeout 30m -bench=. ./...

test: govet govulncheck test-unit

.PHONY: test test-unit test-race test-cover bench

#################
###  Install  ###
#################

all: install

install:
	@echo "--> ensure dependencies have not been modified"
	@go mod verify
	@echo "--> installing $(APPNAME)d"
	@go install $(BUILD_FLAGS) -mod=readonly ./cmd/$(APPNAME)d

.PHONY: all install

##################
###  Protobuf  ###
##################

# Use this target if you do not want to use Ignite for generating proto files

proto-deps:
	@echo "Installing proto deps"
	@echo "Proto deps present, run 'go tool' to see them"

proto-gen:
	@echo "Generating protobuf files..."
	@ignite generate proto-go --yes

.PHONY: proto-gen

#################
###  Linting  ###
#################

lint:
	@echo "--> Running linter"
	@go tool github.com/golangci/golangci-lint/cmd/golangci-lint run ./... --timeout 15m

lint-fix:
	@echo "--> Running linter and fixing issues"
	@go tool github.com/golangci/golangci-lint/cmd/golangci-lint run ./... --fix --timeout 15m

.PHONY: lint lint-fix

###################
### Development ###
###################

govet:
	@echo Running go vet...
	@go vet ./...

govulncheck:
	@echo Running govulncheck...
	@go tool golang.org/x/vuln/cmd/govulncheck@latest
	@govulncheck ./...

.PHONY: govet govulncheck