'use strict';

module.exports = {
  cache_for(res, duration=(365 * 24 * 60 * 60)) {
    res.cache_for = duration;
    const exp = new Date(Date.now() + (duration * 1000));
    res.setHeader('Cache-Control', `public, max-age=${duration}`);
    res.setHeader('Expires', exp.toGMTString());
  }
};
