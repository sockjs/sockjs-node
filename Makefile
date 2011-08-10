.PHONY: all

all: src/*coffee
	coffee -o lib/ -c src/*.coffee

serve:
	@while [ 1 ]; do					\
		make all;						\
	    inotifywait -r -q -e modify .;	\
	    sleep 0.1;						\
	done
