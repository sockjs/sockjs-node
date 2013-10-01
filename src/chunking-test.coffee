# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

utils = require('./utils')

exports.app =
    # TODO: remove in next major release
    chunking_test: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        write = (payload) =>
            try
                res.write(payload + '\n')
            catch x
                return

        utils.timeout_chain([
            # IE requires 2KB prelude
            [0, => write('h')],
            [1, => write(Array(2049).join(' ') + 'h')],
            [5, => write('h')],
            [25, => write('h')],
            [125, => write('h')],
            [625, => write('h')],
            [3125, => write('h'); res.end()],
        ])
        return true

    info: (req, res, _) ->
        info = {
            websocket: @options.websocket,
            origins: ['*:*'],
            cookie_needed: not not @options.jsessionid,
            entropy: utils.random32(),
        }
        # Users can specify a new base URL which further requests will be made
        # against. For example, it may contain a randomized domain name to
        # avoid browser per-domain connection limits.
        if typeof @options.base_url is 'function'
            info.base_url = @options.base_url()
        else if @options.base_url
            info.base_url = @options.base_url
        res.setHeader('Content-Type', 'application/json; charset=UTF-8')
        res.writeHead(200)
        res.end(JSON.stringify(info))

    info_options: (req, res) ->
        res.statusCode = 204
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET')
        res.setHeader('Access-Control-Max-Age', res.cache_for)
        return ''
