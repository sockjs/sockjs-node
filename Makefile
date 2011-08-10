.PHONY: all

all: src/*coffee
	coffee -o lib/ -c src/*.coffee

