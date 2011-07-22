#!/bin/sh
if [ -e .pidfile.pid ]; then
    kill `cat .pidfile.pid`
    rm .pidfile.pid
fi

while [ 1 ]; do
    echo " [*] Compiling coffee"
    coffee -o lib/ -c src/*.coffee && while [ 1 ]; do
        echo " [*] Running node"
        node test-server.js &
        NODEPID=$!
        echo $NODEPID > .pidfile.pid

        echo " [*] node pid: $NODEPID"
        break
    done

    inotifywait -r -q -e modify .
    kill $NODEPID
    rm -f .pidfile.pid
    # Sync takes some time, wait to avoid races.
    sleep 0.1
done
