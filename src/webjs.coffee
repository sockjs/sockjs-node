url = require('url')
querystring = require('querystring')
fs = require('fs')

utils = require('./utils')

$ = require('jquery');

execute_request = (app, funs, req, res, data) ->
    try
        while funs.length > 0
            fun = funs.shift()
            req.last_fun = fun
            data = app[fun](req, res, data, req.next_filter)
    catch x
        if typeof x is 'object' and 'status' of x
            if x.status is 0
                true
            else if 'handle_' + x.status of app
                app['handle_' + x.status](req, res, x)
            else
                app.handle_error(req, res, x)
        else
           app.handle_error(req, res, x)

class WebJS
    constructor: (@app, @dispatcher) ->

    handler: (req, res, head) ->
        that = this
        $.extend(req, url.parse(req.url, true))

        found = false
        allowed_methods = []
        for row in @dispatcher
            [method, path, funs] = row
            if $.type(path) isnt "array"
                path = [path]
            # path[0] must be a regexp
            m = req.pathname.match(path[0])
            if not m
                continue
            if req.method isnt method
                allowed_methods.push(method)
                continue
            for i in [1...path.length]
                req[path[i]] = m[i]

            if typeof res.writeHead is "undefined"
                # TODO: this is quite obviously wrong.
                headers = []
                res.writeHead = (status, user_headers, content) ->
                    r = []
                    r.push('HTTP/'+req.httpVersion+ ' '+status+' '+http.STATUS_CODES[status])
                    r = r.concat(user_headers)
                    r = r.concat(headers)
                    r.push('')
                    if content
                        r.push(content)
                    try
                        res.write(r.join('\r\n'))
                    catch e
                        null

                res.setHeader = (k, v) -> headers.push(k+': '+v)
            req.start_date = new Date()
            funs = funs[0..]
            funs.push('log')
            req.next_filter = (data) ->
                execute_request(that.app, funs, req, res, data)
            req.next_filter(head)
            found = true
            break

        if not found
            if allowed_methods.length isnt 0
                that.app.handle_405(req, res, allowed_methods)
            else
                return false
        return true

exports.WebJS = WebJS
exports.generic_app =
    handle_404: (req, res, x) ->
        if res.finished
            return x
        res.writeHead(404, {})
        res.end("404 - Not Found")
        return true

    handle_405:(req, res, methods) ->
        res.writeHead(405, {'Allow': methods.join(', ')})
        res.end("405 - Method Not Alloweds")
        return true

    handle_error: (req, res, x) ->
        # console.log('handle_error', x.stack)
        if res.finished
            return x
        if typeof x is 'object' and 'status' of x
            res.writeHead(x.status, {})
            res.end("" + x.status + " " + x.message)
        else
            try
                res.writeHead(500, {})
                res.end("500 - Internal Server Error")
            catch y
            console.log('Caught error on "'+ req.method + ' ' + req.href + ''
                        '" in filter "' + req.last_fun + '":\n' + (x.stack || x))
        return true

    log: (req, res, data) ->
        td = (new Date()) - req.start_date
        console.log(req.method, req.url, td, 'ms',
            if res.finished then res._header.split('\r')[0] else '(unfinished)')
        return data

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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        return content

    expect_form: (req, res, _data, next_filter) ->
        data = new Buffer(0)
        req.on 'data', (d) ->
            data = utils.buffer_concat(data, new Buffer(d, 'binary'))
        req.on 'end', ->
            data = data.toString('utf-8')
            switch (req.headers['content-type'] or '').split(';')[0]
                when 'application/x-www-form-urlencoded'
                    q = querystring.parse(data)
                    break
                when 'text/plain', ''
                    q = data
                else
                    console.log("unsupported content-type", req.headers['content-type'])
                    q = undefined
            next_filter(q)
        throw {status:0}

    expect_xhr: (req, res, _data, next_filter) ->
        data = new Buffer(0)
        req.on 'data', (d) ->
            data = utils.buffer_concat(data, new Buffer(d, 'binary'))
        req.on 'end', ->
            data = data.toString('utf-8')
            switch (req.headers['content-type'] or '').split(';')[0]
                when 'text/plain', 'T', 'application/json', 'application/xml', ''
                    q = data
                else
                    console.log("unsupported content-type", req.headers['content-type'])
                    q = undefined
            next_filter(q)
        throw {status:0}

    h_sid: (req, res, data) ->
        # Some load balancers do sticky sessions, but only if there is
        # a JSESSIONID cookie. If this cookie isn't yet set, we shall
        # set it to a dumb value. It doesn't really matter what, as
        # session information is usually added by the load balancer.
        req.cookies = {}
        if req.headers.cookie
            for cookie in req.headers.cookie.split(';')
                parts = cookie.split('=')
                req.cookies[ parts[0].trim() ] = ( parts[1] || '' ).trim()
        if res.setHeader
            # We need to set it every time, to give the loadbalancer
            # opportunity to attach its own cookies.
            jsid = req.cookies['JSESSIONID'] or 'a'
            res.setHeader('Set-Cookie', 'JSESSIONID=' + jsid + '; path=/')
        return data
