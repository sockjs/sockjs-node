.PHONY: all serve clean

all: src/*coffee
	@coffee -v > /dev/null
	coffee -o lib/ -c src/*.coffee

serve:
	@while [ 1 ]; do					\
		make all;					\
	    sleep 0.1;						\
	    inotifywait -r -q -e modify .;			\
	done

clean:
	rm -f lib/*.js


# Release process:
#   1) commit everything
#   2) amend version in package.json
#   3) run 'make tag' and run suggested 'git push' variants
#   4) run 'npm publish'

RVER:=$(shell grep "version" package.json|tr '\t"' ' \t'|cut -f 4)
VER:=$(shell ./VERSION-GEN)

.PHONY: tag
tag: all
	-git tag -d v$(RVER)
	git commit $(TAG_OPTS) package.json Changelog -m "Release $(RVER)"
	git tag -a v$(RVER) -m "Release $(RVER)"
	@echo ' [*] Now run'
	@echo 'git push; git push --tag'
