# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

url = require('url')
querystring = require('querystring')
fs = require('fs')
http = require('http')

utils = require('./utils')


execute_request = (app, funs, req, res, data) ->
    try
        while funs.length > 0
            fun = funs.shift()
            req.last_fun = fun
            data = app[fun](req, res, data, req.next_filter)
    catch x
        if typeof x is 'object' and 'status' of x
            if x.status is 0
                return
            else if 'handle_' + x.status of app
                app['handle_' + x.status](req, res, x)
            else
                app['handle_error'](req, res, x)
        else
           app['handle_error'](req, res, x)
        app['log_request'](req, res, true)


fake_response = (req, res) ->
        # This is quite simplistic, don't expect much.
        headers = {'Connection': 'close'}
        res.writeHead = (status, user_headers = {}) ->
            r = []
            r.push('HTTP/' + req.httpVersion + ' ' + status +
                   ' ' + http.STATUS_CODES[status])
            utils.objectExtend(headers, user_headers)
            for k of headers
                r.push(k + ': ' + headers[k])
            r = r.concat(['', ''])
            try
                res.write(r.join('\r\n'))
            catch x
            try
                res.end()
            catch x
        res.setHeader = (k, v) -> headers[k] = v


exports.generateHandler = (app, dispatcher) ->
    return (req, res, head) ->
        if typeof res.writeHead is "undefined"
            fake_response(req, res)
        utils.objectExtend(req, url.parse(req.url, true))
        req.start_date = new Date()

        found = false
        allowed_methods = []
        for row in dispatcher
            [method, path, funs] = row
            if path.constructor isnt Array
                path = [path]
            # path[0] must be a regexp
            m = req.pathname.match(path[0])
            if not m
                continue
            if not req.method.match(new RegExp(method))
                allowed_methods.push(method)
                continue
            for i in [1...path.length]
                req[path[i]] = m[i]
            funs = funs[0..]
            funs.push('log_request')
            req.next_filter = (data) ->
                execute_request(app, funs, req, res, data)
            req.next_filter(head)
            found = true
            break

        if not found
            if allowed_methods.length isnt 0
                app['handle_405'](req, res, allowed_methods)
            else
                app['handle_404'](req, res)
            app['log_request'](req, res, true)
        return

exports.GenericApp = class GenericApp
    handle_404: (req, res, x) ->
        if res.finished
            return x
        res.writeHead(404, {})
        res.end()
        return true

    handle_405:(req, res, methods) ->
        res.writeHead(405, {'Allow': methods.join(', ')})
        res.end()
        return true

    handle_error: (req, res, x) ->
        # console.log('handle_error', x.stack)
        if res.finished
            return x
        if typeof x is 'object' and 'status' of x
            res.writeHead(x.status, {})
            res.end((x.message or ""))
        else
            try
                res.writeHead(500, {})
                res.end("500 - Internal Server Error")
            catch x
            @log('error', 'Exception on "'+ req.method + ' ' + req.href + '" in filter "' + req.last_fun + '":\n' + (x.stack || x))
        return true

    log_request: (req, res, data) ->
        td = (new Date()) - req.start_date
        @log('info', req.method + ' ' + req.url + ' ' + td + 'ms ' +
                (if res.finished then res.statusCode else '(unfinished)'))
        return data

    log: (severity, line) ->
        console.log(line)

    expose_html: (req, res, content) ->
        if res.finished
            return content
        if not res.getHeader('Content-Type')
            res.setHeader('Content-Type', 'text/html; charset=UTF-8')
        return @expose(req, res, content)

    expose_json: (req, res, content) ->
        if res.finished
            return content
        if not res.getHeader('Content-Type')
            res.setHeader('Content-Type', 'application/json')
        return @expose(req, res, JSON.stringify(content))

    expose: (req, res, content) ->
        if res.finished
            return content
        if content and not res.getHeader('Content-Type')
            res.setHeader('Content-Type', 'text/plain')
        if content
            res.setHeader('Content-Length', content.length)
        res.writeHead(res.statusCode)
        res.end(content, 'utf8')
        return true

    serve_file: (req, res, filename, next_filter) ->
        a = (error, content) ->
            if error
                res.writeHead(500)
                res.end("can't read file")
            else
                res.setHeader('Content-length', content.length)
                res.writeHead(res.statusCode, res.headers)
                res.end(content, 'utf8')
            next_filter(true)
        fs.readFile(filename, a)
        throw {status:0}

    cache_for: (req, res, content) ->
        res.cache_for = res.cache_for or 365 * 24 * 60 * 60 # one year.
        # See: http://code.google.com/speed/page-speed/docs/caching.html
        res.setHeader('Cache-Control', 'public, max-age=' + res.cache_for)
        exp = new Date()
        exp.setTime(exp.getTime() + res.cache_for * 1000)
        res.setHeader('Expires', exp.toGMTString())
        return content

    h_no_cache: (req, res, content) ->
        res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, max-age=0')
        return content

    expect_form: (req, res, _data, next_filter) ->
        data = new Buffer(0)
        req.on 'data', (d) =>
            data = utils.buffer_concat(data, new Buffer(d, 'binary'))
        req.on 'end', =>
            data = data.toString('utf-8')
            switch (req.headers['content-type'] or '').split(';')[0]
                when 'application/x-www-form-urlencoded'
                    q = querystring.parse(data)
                when 'text/plain', ''
                    q = data
                else
                    @log('error', "Unsupported content-type " +
                                  req.headers['content-type'])
                    q = undefined
            next_filter(q)
        throw {status:0}

    expect_xhr: (req, res, _data, next_filter) ->
        data = new Buffer(0)
        req.on 'data', (d) =>
            data = utils.buffer_concat(data, new Buffer(d, 'binary'))
        req.on 'end', =>
            data = data.toString('utf-8')
            switch (req.headers['content-type'] or '').split(';')[0]
                when 'text/plain', 'T', 'application/json', 'application/xml', '', 'text/xml'
                    q = data
                else
                    @log('error', 'Unsupported content-type ' +
                                  req.headers['content-type'])
                    q = undefined
            next_filter(q)
        throw {status:0}
