#!/bin/bash

set -e

rm -rf sockjs-protocol
git clone --depth=1 https://github.com/sockjs/sockjs-protocol.git

node tests/test_server/server.js &
SRVPID=$!
sleep 1

set +e

DOCKER_NETWORK_ARGS="--add-host host.docker.internal:host-gateway"
if [ "$(uname -s)" = "Linux" ] && [ -n "${CI:-}" ]; then
  DOCKER_NETWORK_ARGS="--network host"
fi

docker run \
       --rm \
       --volume $(pwd):$(pwd) \
       --workdir $(pwd)/sockjs-protocol \
       ${DOCKER_NETWORK_ARGS} \
       python:2.7 \
       sh -c 'make test_deps pycco_deps && ./venv/bin/python sockjs-protocol.py'

PASSED=$?
kill $SRVPID
exit $PASSED
