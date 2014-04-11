test:
	mocha -w test/index.test.js

build: node_modules
	node build.js

node_modules: package.json
	npm install

.PHONY: build test
