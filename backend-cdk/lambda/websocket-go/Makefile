.PHONY: build clean

build:
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o bootstrap .

clean:
	rm -f bootstrap
